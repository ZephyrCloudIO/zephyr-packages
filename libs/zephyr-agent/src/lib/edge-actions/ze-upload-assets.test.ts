import { refreshApplicationConfiguration } from '../auth/refresh-auth';
import { isTokenStillValid } from '../auth/login';
import { uploadFile } from '../http/upload-file';
import { zeUploadAssets } from './ze-upload-assets';

jest.mock('../http/upload-file');
jest.mock('../auth/login');
jest.mock('../auth/refresh-auth');

describe('zeUploadAssets', () => {
  const mockUploadFile = jest.mocked(uploadFile);
  const mockIsTokenStillValid = jest.mocked(isTokenStillValid);
  const mockRefreshApplicationConfiguration = jest.mocked(
    refreshApplicationConfiguration
  );

  const appConfig = {
    application_uid: 'zephyr.packages.test-app',
    EDGE_URL: 'https://edge.zephyr.com',
    jwt: 'expired-jwt-token',
    ENVIRONMENTS: undefined,
  } as const;

  const refreshedConfig = {
    ...appConfig,
    jwt: 'refreshed-jwt-token',
  } as const;

  const gitProperties = {
    app: { org: 'zephyr', project: 'packages' },
    git: {
      name: 'Test User',
      email: 'test@zephyrcloud.io',
      branch: 'main',
      commit: 'abc123',
      tags: [],
    },
  };

  const assetsMap = {
    hash1: {
      hash: 'hash1',
      path: 'assets/a.js',
      size: 100,
      buffer: Buffer.from('a'),
    },
    hash2: {
      hash: 'hash2',
      path: 'assets/b.js',
      size: 200,
      buffer: Buffer.from('b'),
    },
  } as never;

  const missingAssets = [
    { hash: 'hash1', path: 'assets/a.js' },
    { hash: 'hash2', path: 'assets/b.js' },
  ] as never;

  const zephyrEngine = {
    application_uid: appConfig.application_uid,
    gitProperties,
    application_configuration: Promise.resolve(appConfig),
    logger: Promise.resolve(jest.fn()),
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadFile.mockResolvedValue(undefined);
    mockIsTokenStillValid.mockReturnValue(false);
    mockRefreshApplicationConfiguration.mockResolvedValue(refreshedConfig as never);
  });

  it('refreshes auth once and reuses refreshed config for all uploads', async () => {
    await zeUploadAssets(zephyrEngine, {
      missingAssets,
      assetsMap,
    });

    expect(mockRefreshApplicationConfiguration).toHaveBeenCalledTimes(1);
    expect(mockRefreshApplicationConfiguration).toHaveBeenCalledWith(
      {
        application_uid: appConfig.application_uid,
        git_config: gitProperties,
      },
      { edgeUrl: appConfig.EDGE_URL }
    );

    expect(mockUploadFile).toHaveBeenCalledTimes(2);
    expect(mockUploadFile.mock.calls[0]?.[1]).toEqual(refreshedConfig);
    expect(mockUploadFile.mock.calls[1]?.[1]).toEqual(refreshedConfig);
  });
});
