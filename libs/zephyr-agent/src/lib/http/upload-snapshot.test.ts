import { type ZeGitInfo } from '../build-context/ze-util-get-git-info';
import { ZeErrors, ZephyrError } from '../errors';
import {
  getApplicationConfiguration,
  invalidateApplicationConfigCache,
} from '../edge-requests/get-application-configuration';
import { checkAuth, isTokenStillValid } from '../auth/login';
import * as httpRequest from './http-request';
import { uploadSnapshot } from './upload-snapshot';

jest.mock('./http-request');
jest.mock('../auth/login');
jest.mock('../edge-requests/get-application-configuration');
jest.mock('../logging', () => ({
  ze_log: {
    snapshot: jest.fn(),
  },
}));

describe('uploadSnapshot', () => {
  const mockMakeRequest = jest.mocked(httpRequest.makeRequest);
  const mockCheckAuth = jest.mocked(checkAuth);
  const mockIsTokenStillValid = jest.mocked(isTokenStillValid);
  const mockGetApplicationConfiguration = jest.mocked(getApplicationConfiguration);
  const mockInvalidateApplicationConfigCache = jest.mocked(
    invalidateApplicationConfigCache
  );

  const gitConfig: ZeGitInfo = {
    app: {
      org: 'zephyr',
      project: 'packages',
    },
    git: {
      name: 'Test User',
      email: 'test@zephyrcloud.io',
      branch: 'main',
      commit: '0123456789abcdef',
      tags: [],
    },
  };

  const application_uid = 'zephyr.packages.test-app';
  const snapshot = {
    version: 1,
    data: {
      foo: 'bar',
    },
  };

  const config = {
    application_uid,
    EDGE_URL: 'https://edge.zephyr.com',
    jwt: 'test-jwt-token',
    ENVIRONMENTS: undefined,
  } as const;

  const response = {
    urls: {
      version: 'https://edge.zephyr.com/version.json',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckAuth.mockResolvedValue();
    mockIsTokenStillValid.mockReturnValue(true);
    mockInvalidateApplicationConfigCache.mockResolvedValue();
    mockGetApplicationConfiguration.mockResolvedValue(config as never);
  });

  it('uploads snapshot successfully', async () => {
    mockMakeRequest.mockResolvedValueOnce([true, null, response] as never);

    const resp = await uploadSnapshot({
      body: snapshot as never,
      application_uid,
      git_config: gitConfig,
    });

    expect(resp).toEqual(response);
    expect(mockMakeRequest).toHaveBeenCalledTimes(1);
    expect(mockMakeRequest).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: expect.objectContaining({
          can_write_jwt: config.jwt,
        }),
      }),
      JSON.stringify(snapshot)
    );
  });

  it('refreshes auth before upload when jwt is expired', async () => {
    mockIsTokenStillValid.mockReturnValue(false);
    mockGetApplicationConfiguration
      .mockResolvedValueOnce(config as never)
      .mockResolvedValueOnce({ ...config, jwt: 'refreshed-jwt-token' } as never);
    mockMakeRequest.mockResolvedValueOnce([true, null, response] as never);

    await uploadSnapshot({
      body: snapshot as never,
      application_uid,
      git_config: gitConfig,
    });

    expect(mockCheckAuth).toHaveBeenCalledWith(gitConfig);
    expect(mockInvalidateApplicationConfigCache).toHaveBeenCalledWith(application_uid);
    expect(mockMakeRequest).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: expect.objectContaining({
          can_write_jwt: 'refreshed-jwt-token',
        }),
      }),
      JSON.stringify(snapshot)
    );
  });

  it('retries upload once after auth error', async () => {
    mockGetApplicationConfiguration.mockResolvedValue({
      ...config,
      jwt: 'refreshed-jwt-token',
    } as never);
    mockMakeRequest
      .mockResolvedValueOnce([
        false,
        new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
          message: 'Unauthenticated request',
        }),
      ] as never)
      .mockResolvedValueOnce([true, null, response] as never);

    await uploadSnapshot({
      body: snapshot as never,
      application_uid,
      git_config: gitConfig,
    });

    expect(mockCheckAuth).toHaveBeenCalledWith(gitConfig);
    expect(mockMakeRequest).toHaveBeenCalledTimes(2);
  });

  it('throws jwt invalid if auth still fails after retry', async () => {
    mockMakeRequest
      .mockResolvedValueOnce([
        false,
        new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
          message: 'Unauthenticated request',
        }),
      ] as never)
      .mockResolvedValueOnce([
        false,
        new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
          message: 'Unauthenticated request',
        }),
      ] as never);

    await expect(
      uploadSnapshot({
        body: snapshot as never,
        application_uid,
        git_config: gitConfig,
      })
    ).rejects.toMatchObject({
      code: ZephyrError.toZeCode(ZeErrors.ERR_JWT_INVALID),
    });
  });
});
