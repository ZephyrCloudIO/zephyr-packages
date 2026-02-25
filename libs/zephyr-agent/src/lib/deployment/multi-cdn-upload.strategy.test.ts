import type { ZeApplicationConfig } from '../node-persist/upload-provider-options';
import { UploadProviderType } from '../node-persist/upload-provider-options';
import { multiCdnUploadStrategy } from './multi-cdn-upload.strategy';

import { zeUploadSnapshot } from '../edge-actions';
import { uploadAssets } from './upload-base/upload-assets';
import { uploadBuildStatsAndEnableEnvs } from './upload-base/upload-build-stats-and-enable-envs';

jest.mock('../edge-actions', () => ({
  zeUploadSnapshot: jest.fn(),
}));

jest.mock('./upload-base/upload-assets', () => ({
  uploadAssets: jest.fn(),
}));

jest.mock('./upload-base/upload-build-stats-and-enable-envs', () => ({
  uploadBuildStatsAndEnableEnvs: jest.fn(),
}));

jest.mock('../logging', () => ({
  ze_log: {
    upload: jest.fn(),
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeConfig(integrationName: string, isPrimary: boolean): ZeApplicationConfig {
  return {
    application_uid: 'app-123',
    BUILD_ID_ENDPOINT: 'https://api.example.com/build-id',
    EDGE_URL: `https://${integrationName}.edge.example.com`,
    DELIMITER: '/',
    PLATFORM: UploadProviderType.CLOUDFLARE,
    email: 'test@example.com',
    jwt: `jwt-${integrationName}`,
    user_uuid: 'user-123',
    username: 'tester',
    _metadata: {
      isPrimary,
      integrationName,
      integrationId: `id-${integrationName}`,
    },
  };
}

describe('multiCdnUploadStrategy', () => {
  const mockZeUploadSnapshot = zeUploadSnapshot as unknown as jest.Mock;
  const mockUploadAssets = uploadAssets as unknown as jest.Mock;
  const mockUploadBuildStatsAndEnableEnvs =
    uploadBuildStatsAndEnableEnvs as unknown as jest.Mock;

  const uploadOptions: any = {
    snapshot: {},
    getDashData: () => ({ edge: {} }),
    assets: { assetsMap: {}, missingAssets: [] },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadAssets.mockResolvedValue(true);
    mockUploadBuildStatsAndEnableEnvs.mockResolvedValue(true);
  });

  it('deploys primary first, then deploys all other configs as secondaries and reports all statuses together', async () => {
    const primary = makeConfig('primary', true);
    const secondaryAlsoPrimary = makeConfig('secondary-primary', true);
    const secondary = makeConfig('secondary', false);

    const primaryGate = deferred<string>();

    mockZeUploadSnapshot.mockImplementation(async (engine: any) => {
      const config = await engine.application_configuration;
      const name = config._metadata?.integrationName;

      if (name === 'primary') {
        return primaryGate.promise;
      }

      return `${name}-url`;
    });

    const zephyr_engine: any = {
      application_uid: 'app-123',
      application_configuration: Promise.resolve(primary),
    };

    const run = multiCdnUploadStrategy(
      zephyr_engine,
      [primary, secondaryAlsoPrimary, secondary],
      uploadOptions
    );

    // While primary is blocked, no secondary deployment should start.
    await Promise.resolve();
    expect(mockZeUploadSnapshot).toHaveBeenCalledTimes(1);

    primaryGate.resolve('primary-url');
    const result = await run;

    expect(result.primaryUrl).toBe('primary-url');
    expect(result.secondaryUrls.map((s) => s.integrationName)).toEqual(
      expect.arrayContaining(['secondary-primary', 'secondary'])
    );
    expect(result.allUrls).toEqual(
      expect.arrayContaining(['primary-url', 'secondary-primary-url', 'secondary-url'])
    );

    expect(mockUploadBuildStatsAndEnableEnvs).toHaveBeenCalledTimes(1);
    const [, opts] = mockUploadBuildStatsAndEnableEnvs.mock.calls[0];
    expect(opts.versionUrl).toBe('primary-url');

    const names = (opts.deploymentResults ?? []).map((r: any) => r.integrationName);
    expect(names).toEqual(
      expect.arrayContaining(['primary', 'secondary-primary', 'secondary'])
    );
  });

  it('does not fail the deploy flow if build-stats reporting fails (best-effort reporting)', async () => {
    const primary = makeConfig('primary', true);
    const secondary = makeConfig('secondary', false);

    mockZeUploadSnapshot.mockImplementation(async (engine: any) => {
      const config = await engine.application_configuration;
      return `${config._metadata?.integrationName}-url`;
    });

    mockUploadBuildStatsAndEnableEnvs.mockRejectedValueOnce(new Error('report failed'));

    const zephyr_engine: any = {
      application_uid: 'app-123',
      application_configuration: Promise.resolve(primary),
    };

    await expect(
      multiCdnUploadStrategy(zephyr_engine, [primary, secondary], uploadOptions)
    ).resolves.toMatchObject({
      primaryUrl: 'primary-url',
      allUrls: expect.arrayContaining(['primary-url', 'secondary-url']),
    });

    expect(mockUploadBuildStatsAndEnableEnvs).toHaveBeenCalledTimes(1);
  });

  it('throws when primary deployment fails and does not attempt secondaries', async () => {
    const primary = makeConfig('primary', true);
    const secondary = makeConfig('secondary', false);

    mockZeUploadSnapshot.mockImplementation(async (engine: any) => {
      const config = await engine.application_configuration;
      const name = config._metadata?.integrationName;
      if (name === 'primary') {
        throw new Error('primary failed');
      }
      return `${name}-url`;
    });

    const zephyr_engine: any = {
      application_uid: 'app-123',
      application_configuration: Promise.resolve(primary),
    };

    await expect(
      multiCdnUploadStrategy(zephyr_engine, [primary, secondary], uploadOptions)
    ).rejects.toThrow();

    // Primary attempted only; secondaries should not start.
    expect(mockZeUploadSnapshot).toHaveBeenCalledTimes(1);

    // Should try to report the primary failure status (best-effort)
    expect(mockUploadBuildStatsAndEnableEnvs).toHaveBeenCalledTimes(1);
    const [, opts] = mockUploadBuildStatsAndEnableEnvs.mock.calls[0];
    expect(opts.versionUrl).toBeUndefined();
    expect(opts.deploymentResults?.[0]?.integrationName).toBe('primary');
    expect(opts.deploymentResults?.[0]?.status).toBe('FAILED');
  });
});
