// Importing for mocks
import '../errors';
import * as httpRequest from './http-request';
import { uploadFile } from './upload-file';
import type { UploadableAsset } from 'zephyr-edge-contract';

// Mock dependencies
jest.mock('./http-request');
jest.mock('../auth/login');
jest.mock('../edge-requests/get-application-configuration');

// Mock the ZeErrors and ZephyrError
jest.mock('../errors', () => {
  const originalModule = jest.requireActual('../errors');

  // Create mock error code
  const ZE_ERR_FAILED_UPLOAD = 'ZE40017';

  return {
    ...originalModule,
    ZeErrors: {
      ...originalModule.ZeErrors,
      ERR_FAILED_UPLOAD: {
        id: '017',
        kind: 'deploy',
        message: 'Failed upload',
      },
    },
    ZephyrError: class MockZephyrError extends Error {
      code: string;
      data?: Record<string, unknown>;
      template?: Record<string, unknown>;
      cause?: unknown;

      constructor(type: any, opts?: any) {
        super(type.message || 'Mock Error');

        // Use direct mapping for ERR_FAILED_UPLOAD
        if (type === originalModule.ZeErrors.ERR_FAILED_UPLOAD) {
          this.code = ZE_ERR_FAILED_UPLOAD;
        } else {
          this.code = 'ZE99999';
        }

        if (opts) {
          const { cause, data, ...template } = opts;
          this.template = template;
          this.data = data;
          this.cause = cause;
        }
      }

      static is(err: unknown): boolean {
        return err instanceof MockZephyrError;
      }
    },
  };
});

describe('uploadFile', () => {
  // Create mock for makeRequest
  const mockMakeRequest = jest.spyOn(httpRequest, 'makeRequest');

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock isTokenStillValid to return true for tests
    const { isTokenStillValid } = require('../auth/login');
    jest.mocked(isTokenStillValid).mockReturnValue(true);
  });

  it('should upload a file successfully', async () => {
    // Mock successful response
    mockMakeRequest.mockResolvedValueOnce([true, null]);

    // Create test asset
    const hash = 'abc123';
    const asset: UploadableAsset = {
      path: 'assets/image.png',
      size: 1024,
      buffer: Buffer.from('test-content'),
    };

    // Create test config
    const config = {
      EDGE_URL: 'https://api.zephyr.com',
      jwt: 'test-jwt-token',
    };

    // Execute the function
    await uploadFile({ hash, asset }, config);

    // Verify makeRequest was called with correct arguments
    expect(mockMakeRequest).toHaveBeenCalledWith(
      {
        path: '/upload',
        base: 'https://api.zephyr.com',
        query: {
          type: 'file',
          hash: 'abc123',
          filename: 'assets/image.png',
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

  it('should throw error if upload fails', async () => {
    // Mock error response
    const errorCause = new Error('Upload failed');
    mockMakeRequest.mockResolvedValueOnce([false, errorCause]);

    // Create test asset
    const hash = 'abc123';
    const asset: UploadableAsset = {
      path: 'assets/image.png',
      size: 1024,
      buffer: Buffer.from('test-content'),
    };

    // Create test config
    const config = {
      EDGE_URL: 'https://api.zephyr.com',
      jwt: 'test-jwt-token',
    };

    // Execute the function and expect it to throw
    await expect(uploadFile({ hash, asset }, config)).rejects.toThrow();

    // Reset the mock and set up for the second call
    mockMakeRequest.mockReset();
    mockMakeRequest.mockResolvedValueOnce([false, errorCause]);

    // Test that an error is thrown
    let errorThrown: any = null;
    try {
      await uploadFile({ hash, asset }, config);
    } catch (error) {
      errorThrown = error;
    }

    expect(errorThrown).not.toBeNull();
  });
});
