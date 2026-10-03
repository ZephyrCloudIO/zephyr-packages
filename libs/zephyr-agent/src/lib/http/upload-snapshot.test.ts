import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Snapshot } from 'zephyr-edge-contract';
import {
  UploadProviderType,
  type EnvironmentConfig,
  type ZeApplicationConfig,
} from '../node-persist/upload-provider-options';

const mocks = rs.hoisted(() => ({
  getApplicationConfiguration: rs.fn(),
  makeRequest: rs.fn(),
}));

rs.mock('../edge-requests/get-application-configuration', () => ({
  getApplicationConfiguration: mocks.getApplicationConfiguration,
}));

rs.mock('./http-request', () => ({
  makeRequest: mocks.makeRequest,
}));

rs.mock('../logging', () => ({
  ze_log: { snapshot: rs.fn() },
}));

import { ZeErrors, ZephyrError } from '../errors';
import { safeStringifyForLogging } from '../security/redaction';
import {
  createSnapshotUploadTargets,
  getMissingAssetHashes,
  uploadSnapshot,
} from './upload-snapshot';

/** Mirrors the error `makeRequest` returns for a non-2xx edge reply. */
function httpError(status: number, body: unknown): ZephyrError<'ERR_HTTP_ERROR'> {
  return new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
    status,
    url: 'https://primary.example.test/upload',
    method: 'POST',
    content: typeof body === 'string' ? body : safeStringifyForLogging(body),
  });
}

function missingAssetsReply(hashes: string[]) {
  return [false, httpError(409, { error: 'missing_assets', hashes })];
}

function snapshot(): Snapshot {
  return {
    application_uid: 'org.project.app',
    version: '1.0.0-user.1',
    snapshot_id: 'snapshot-1',
    domain: 'https://primary.example.test',
    uid: { build: '1', app_name: 'app', repo: 'project', org: 'org' },
    git: { branch: 'main', commit: 'abc' },
    creator: { name: 'Test', email: 'test@example.test' },
    createdAt: 1,
    assets: {
      'assets/app.js': {
        path: 'assets/app.js',
        extname: '.js',
        hash: 'asset-hash',
        size: 10,
      },
    },
  };
}

function environment(edgeUrl: string): EnvironmentConfig {
  return {
    type: UploadProviderType.CLOUDFLARE,
    edgeUrl,
    delimiter: '.',
    remote_host: new URL(edgeUrl).hostname,
  };
}

function applicationConfig(
  overrides: Partial<ZeApplicationConfig> = {}
): ZeApplicationConfig {
  return {
    application_uid: 'org.project.app',
    BUILD_ID_ENDPOINT: '/build-id',
    EDGE_URL: 'https://primary.example.test',
    DELIMITER: '.',
    PLATFORM: UploadProviderType.CLOUDFLARE,
    email: 'test@example.test',
    jwt: 'jwt',
    user_uuid: 'user-1',
    username: 'Test',
    ...overrides,
  };
}

describe('snapshot upload targets', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('clones the snapshot domain for each target', () => {
    const original = snapshot();
    const targets = createSnapshotUploadTargets(
      original,
      applicationConfig({
        ENVIRONMENTS: {
          path: environment('https://path.example.test'),
          hostname: environment('https://host.example.test'),
        },
      })
    );

    expect(targets.map(({ edgeUrl }) => edgeUrl)).toEqual([
      'https://primary.example.test',
      'https://host.example.test',
      'https://path.example.test',
    ]);
    expect(targets[0]?.snapshot).toMatchObject({
      domain: 'https://primary.example.test',
      snapshot_id: original.snapshot_id,
      assets: original.assets,
    });
    expect(targets[2]?.snapshot).toMatchObject({
      domain: 'https://path.example.test',
      snapshot_id: original.snapshot_id,
      assets: original.assets,
    });
  });

  it('deduplicates equivalent edge URLs in deterministic environment-name order', () => {
    const targets = createSnapshotUploadTargets(
      snapshot(),
      applicationConfig({
        ENVIRONMENTS: {
          zebra: environment('https://duplicate.example.test/'),
          alpha: environment('https://duplicate.example.test'),
        },
      })
    );

    expect(targets).toHaveLength(2);
    expect(targets[1]).toMatchObject({
      edgeUrl: 'https://duplicate.example.test',
      snapshot: { domain: 'https://duplicate.example.test' },
    });
  });

  it('uploads target-specific snapshot JSON while preserving primary response', async () => {
    mocks.getApplicationConfiguration.mockResolvedValue(
      applicationConfig({
        ENVIRONMENTS: {
          path: environment('https://path.example.test'),
        },
      })
    );
    const primaryResponse = { urls: { version: 'https://primary/version' } };
    mocks.makeRequest
      .mockResolvedValueOnce([true, null, primaryResponse])
      .mockResolvedValueOnce([true, null, { urls: { version: 'https://path/version' } }]);

    await expect(
      uploadSnapshot({ body: snapshot(), application_uid: 'org.project.app' })
    ).resolves.toBe(primaryResponse);

    expect(mocks.makeRequest).toHaveBeenCalledTimes(2);
    const primaryBody = JSON.parse(mocks.makeRequest.mock.calls[0]?.[2] as string);
    const pathBody = JSON.parse(mocks.makeRequest.mock.calls[1]?.[2] as string);
    expect(primaryBody).toMatchObject({
      domain: 'https://primary.example.test',
      snapshot_id: 'snapshot-1',
    });
    expect(pathBody).toMatchObject({
      domain: 'https://path.example.test',
      snapshot_id: 'snapshot-1',
    });
    expect(pathBody.assets).toEqual(primaryBody.assets);
  });
});

describe('getMissingAssetHashes', () => {
  it('extracts deduplicated hashes from a 409 missing_assets reply', () => {
    expect(
      getMissingAssetHashes(
        httpError(409, { error: 'missing_assets', hashes: ['a', 'b', 'a'] })
      )
    ).toEqual(['a', 'b']);
  });

  it.each([
    ['another status', httpError(500, { error: 'missing_assets', hashes: ['a'] })],
    ['another 409 reason', httpError(409, { error: 'conflict', hashes: ['a'] })],
    ['an empty hash list', httpError(409, { error: 'missing_assets', hashes: [] })],
    ['invalid hashes', httpError(409, { error: 'missing_assets', hashes: [1] })],
    ['a non-JSON body', httpError(409, 'Conflict')],
    ['a non-HTTP error', new Error('boom')],
  ])('ignores %s', (_label, error) => {
    expect(getMissingAssetHashes(error)).toBeUndefined();
  });
});

describe('uploadSnapshot missing assets recovery', () => {
  const versionResponse = { urls: { version: 'https://primary/version' } };

  beforeEach(() => {
    rs.clearAllMocks();
    mocks.getApplicationConfiguration.mockResolvedValue(applicationConfig());
  });

  it('restores missing assets and retries the snapshot once', async () => {
    const onMissingAssets = rs.fn().mockResolvedValue(undefined);
    mocks.makeRequest
      .mockResolvedValueOnce(missingAssetsReply(['asset-hash']))
      .mockResolvedValueOnce([true, null, versionResponse]);

    await expect(
      uploadSnapshot({
        body: snapshot(),
        application_uid: 'org.project.app',
        onMissingAssets,
      })
    ).resolves.toBe(versionResponse);

    expect(onMissingAssets).toHaveBeenCalledTimes(1);
    expect(onMissingAssets).toHaveBeenCalledWith({
      hashes: ['asset-hash'],
      edgeUrl: 'https://primary.example.test',
    });
    expect(mocks.makeRequest).toHaveBeenCalledTimes(2);
    expect(mocks.makeRequest.mock.calls[1]?.[2]).toBe(
      mocks.makeRequest.mock.calls[0]?.[2]
    );
  });

  it('restores assets on the environment edge which rejected the snapshot', async () => {
    mocks.getApplicationConfiguration.mockResolvedValue(
      applicationConfig({
        ENVIRONMENTS: { path: environment('https://path.example.test') },
      })
    );
    const onMissingAssets = rs.fn().mockResolvedValue(undefined);
    mocks.makeRequest
      .mockResolvedValueOnce([true, null, versionResponse])
      .mockResolvedValueOnce(missingAssetsReply(['asset-hash']))
      .mockResolvedValueOnce([true, null, versionResponse]);

    await uploadSnapshot({
      body: snapshot(),
      application_uid: 'org.project.app',
      onMissingAssets,
    });

    expect(onMissingAssets).toHaveBeenCalledWith({
      hashes: ['asset-hash'],
      edgeUrl: 'https://path.example.test',
    });
    expect(mocks.makeRequest).toHaveBeenCalledTimes(3);
  });

  it('fails with a retention error when assets are still missing after the retry', async () => {
    const onMissingAssets = rs.fn().mockResolvedValue(undefined);
    mocks.makeRequest
      .mockResolvedValueOnce(missingAssetsReply(['asset-hash']))
      .mockResolvedValueOnce(missingAssetsReply(['asset-hash']));

    const error = await uploadSnapshot({
      body: snapshot(),
      application_uid: 'org.project.app',
      onMissingAssets,
    }).catch((e: unknown) => e);

    expect(ZephyrError.is(error, ZeErrors.ERR_SNAPSHOT_MISSING_ASSETS)).toBe(true);
    expect((error as Error).message).toContain('build retention');
    expect((error as Error).message).toContain('rebuild');
    expect(onMissingAssets).toHaveBeenCalledTimes(1);
    expect(mocks.makeRequest).toHaveBeenCalledTimes(2);
  });

  it('keeps the upload failure when the handler is not provided', async () => {
    mocks.makeRequest.mockResolvedValueOnce(missingAssetsReply(['asset-hash']));

    const error = await uploadSnapshot({
      body: snapshot(),
      application_uid: 'org.project.app',
    }).catch((e: unknown) => e);

    expect(ZephyrError.is(error, ZeErrors.ERR_FAILED_UPLOAD)).toBe(true);
    expect(mocks.makeRequest).toHaveBeenCalledTimes(1);
  });

  it('does not retry unrelated snapshot failures', async () => {
    const onMissingAssets = rs.fn();
    const cause = httpError(500, 'Internal Server Error');
    mocks.makeRequest.mockResolvedValueOnce([false, cause]);

    const error = await uploadSnapshot({
      body: snapshot(),
      application_uid: 'org.project.app',
      onMissingAssets,
    }).catch((e: unknown) => e);

    expect(ZephyrError.is(error, ZeErrors.ERR_FAILED_UPLOAD)).toBe(true);
    expect((error as ZephyrError<'ERR_FAILED_UPLOAD'>).cause).toBe(cause);
    expect(onMissingAssets).not.toHaveBeenCalled();
    expect(mocks.makeRequest).toHaveBeenCalledTimes(1);
  });

  it('surfaces handler failures without retrying the snapshot', async () => {
    const handlerError = new Error('upload failed');
    const onMissingAssets = rs.fn().mockRejectedValue(handlerError);
    mocks.makeRequest.mockResolvedValueOnce(missingAssetsReply(['asset-hash']));

    await expect(
      uploadSnapshot({
        body: snapshot(),
        application_uid: 'org.project.app',
        onMissingAssets,
      })
    ).rejects.toBe(handlerError);
    expect(mocks.makeRequest).toHaveBeenCalledTimes(1);
  });
});
