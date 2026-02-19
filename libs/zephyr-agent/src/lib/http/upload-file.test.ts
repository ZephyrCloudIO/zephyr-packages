import type { UploadableAsset } from 'zephyr-edge-contract';
import { type ZeGitInfo } from '../build-context/ze-util-get-git-info';
import { ZeErrors, ZephyrError } from '../errors';
import {
  getApplicationConfiguration,
  invalidateApplicationConfigCache,
} from '../edge-requests/get-application-configuration';
import { checkAuth, isTokenStillValid } from '../auth/login';
import * as httpRequest from './http-request';
import { uploadFile } from './upload-file';

jest.mock('./http-request');
jest.mock('../auth/login');
jest.mock('../edge-requests/get-application-configuration');

describe('uploadFile', () => {
  const mockMakeRequest = jest.mocked(httpRequest.makeRequest);
  const mockCheckAuth = jest.mocked(checkAuth);
  const mockIsTokenStillValid = jest.mocked(isTokenStillValid);
  const mockGetApplicationConfiguration = jest.mocked(getApplicationConfiguration);
  const mockInvalidateApplicationConfigCache = jest.mocked(
    invalidateApplicationConfigCache
  );

  const hash = 'abc123';
  const asset: UploadableAsset = {
    path: 'assets/image.png',
    size: 1024,
    buffer: Buffer.from('test-content'),
  };

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

  const authContext = {
    application_uid: 'zephyr.packages.test-app',
    git_config: gitConfig,
  };

  const config = {
    application_uid: authContext.application_uid,
    EDGE_URL: 'https://api.zephyr.com',
    jwt: 'test-jwt-token',
  } as const;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckAuth.mockResolvedValue();
    mockIsTokenStillValid.mockReturnValue(true);
    mockInvalidateApplicationConfigCache.mockResolvedValue();
    mockGetApplicationConfiguration.mockResolvedValue({
      ...config,
      jwt: 'refreshed-jwt-token',
    } as never);
  });

  it('uploads a file successfully', async () => {
    mockMakeRequest.mockResolvedValueOnce([true, null] as never);

    await uploadFile({ hash, asset }, config as never, authContext);

    expect(mockMakeRequest).toHaveBeenCalledTimes(1);
    expect(mockMakeRequest).toHaveBeenCalledWith(
      {
        path: '/upload',
        base: config.EDGE_URL,
        query: {
          type: 'file',
          hash,
          filename: asset.path,
        },
      },
      {
        method: 'POST',
        headers: {
          'x-file-size': '1024',
          'x-file-path': 'assets/image.png',
          can_write_jwt: 'test-jwt-token',
          'Content-Type': 'application/octet-stream',
        },
      },
      asset.buffer
    );
  });

  it('throws upload error for non-auth failure', async () => {
    mockMakeRequest.mockResolvedValueOnce([false, new Error('Upload failed')] as never);

    await expect(
      uploadFile({ hash, asset }, config as never, authContext)
    ).rejects.toMatchObject({
      code: ZephyrError.toZeCode(ZeErrors.ERR_FAILED_UPLOAD),
    });

    expect(mockCheckAuth).not.toHaveBeenCalled();
  });

  it('refreshes auth first when jwt is expired', async () => {
    mockIsTokenStillValid.mockReturnValue(false);
    mockMakeRequest.mockResolvedValueOnce([true, null] as never);

    await uploadFile({ hash, asset }, config as never, authContext);

    expect(mockCheckAuth).toHaveBeenCalledWith(gitConfig);
    expect(mockInvalidateApplicationConfigCache).toHaveBeenCalledWith(
      authContext.application_uid
    );
    expect(mockGetApplicationConfiguration).toHaveBeenCalledWith({
      application_uid: authContext.application_uid,
    });
    expect(mockMakeRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({
          can_write_jwt: 'refreshed-jwt-token',
        }),
      }),
      asset.buffer
    );
  });

  it('retries once after auth error with refreshed jwt', async () => {
    mockMakeRequest
      .mockResolvedValueOnce([
        false,
        new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
          message: 'Unauthenticated request',
        }),
      ] as never)
      .mockResolvedValueOnce([true, null] as never);

    await uploadFile({ hash, asset }, config as never, authContext);

    expect(mockCheckAuth).toHaveBeenCalledWith(gitConfig);
    expect(mockMakeRequest).toHaveBeenCalledTimes(2);
    expect(mockMakeRequest.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          can_write_jwt: 'refreshed-jwt-token',
        }),
      })
    );
  });

  it('throws jwt invalid when auth still fails after retry', async () => {
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
      uploadFile({ hash, asset }, config as never, authContext)
    ).rejects.toMatchObject({
      code: ZephyrError.toZeCode(ZeErrors.ERR_JWT_INVALID),
    });
  });
});
