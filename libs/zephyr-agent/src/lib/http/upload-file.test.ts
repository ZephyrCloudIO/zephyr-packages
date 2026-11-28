import { beforeEach, describe, expect, it, rs } from '@rstest/core';

import { createHttpResponseError } from './http-failure';
import * as httpRequest from './http-request';
import { uploadFile } from './upload-file';
import type { UploadableAsset } from 'zephyr-edge-contract';

// Mock dependencies
rs.mock('./http-request', { spy: true });

describe('uploadFile', () => {
  // Create mock for makeRequest
  const mockMakeRequest = rs.spyOn(httpRequest, 'makeRequest');

  beforeEach(() => {
    rs.clearAllMocks();
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

  it('names the file and its size when the edge cannot hold it (413)', async () => {
    mockMakeRequest.mockResolvedValueOnce([
      false,
      createHttpResponseError({
        method: 'POST',
        url: 'https://edge.example/upload',
        status: 413,
        content: 'File is larger than an EdgeKV value can hold.',
      }),
    ]);
    const asset: UploadableAsset = {
      path: 'assets/model.bin',
      size: 734_003,
      buffer: Buffer.alloc(1),
    };

    const upload = uploadFile({ hash: 'abc123', asset }, {
      EDGE_URL: 'https://edge.example',
      jwt: 'jwt',
      PLATFORM: 'akamai',
    } as never);

    await expect(upload).rejects.toThrow(/assets\/model\.bin.*734003 bytes/);
  });
});
