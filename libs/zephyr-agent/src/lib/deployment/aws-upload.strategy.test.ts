import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { ZeBuildAsset, ZeBuildAssetsMap } from 'zephyr-edge-contract';

const mocks = rs.hoisted(() => ({
  getApplicationConfiguration: rs.fn(),
  makeRequest: rs.fn(),
  updateHashList: rs.fn(),
  zeUploadSnapshot: rs.fn(),
  fallbackUploadAssets: rs.fn(),
  uploadBuildStatsAndEnableEnvs: rs.fn(),
}));

rs.mock('../edge-requests/get-application-configuration', () => ({
  getApplicationConfiguration: mocks.getApplicationConfiguration,
}));
rs.mock('../http/http-request', () => ({ makeRequest: mocks.makeRequest }));
rs.mock('../logging', () => ({
  ze_log: { snapshot: rs.fn(), upload: rs.fn(), error: rs.fn() },
}));
rs.mock('../logging/ze-log-event', () => ({ logFn: rs.fn() }));
rs.mock('../edge-hash-list/distributed-hash-control', () => ({
  update_hash_list: mocks.updateHashList,
}));
rs.mock('../edge-actions', () => ({ zeUploadSnapshot: mocks.zeUploadSnapshot }));
rs.mock('./upload-base', () => ({
  uploadAssets: mocks.fallbackUploadAssets,
  uploadBuildStatsAndEnableEnvs: mocks.uploadBuildStatsAndEnableEnvs,
}));

import { awsUploadStrategy } from './aws-upload.strategy';

function createAssets(count: number): {
  assetsMap: ZeBuildAssetsMap;
  missingAssets: ZeBuildAsset[];
} {
  const missingAssets = Array.from({ length: count }, (_, index) => {
    const buffer = Buffer.from(`asset-${index}`);
    return {
      path: `assets/${index}.js`,
      extname: '.js',
      hash: `hash-${index}`,
      size: buffer.length,
      buffer,
    };
  });
  return {
    missingAssets,
    assetsMap: Object.fromEntries(missingAssets.map((asset) => [asset.hash, asset])),
  };
}

describe('awsUploadStrategy', () => {
  const appConfig = {
    application_uid: 'app-id',
    EDGE_URL: 'https://edge.example',
    jwt: 'write-token',
  };

  beforeEach(() => {
    rs.clearAllMocks();
    mocks.getApplicationConfiguration.mockResolvedValue(appConfig);
    mocks.zeUploadSnapshot.mockResolvedValue('https://edge.example/version');
    mocks.uploadBuildStatsAndEnableEnvs.mockResolvedValue(undefined);
    mocks.updateHashList.mockResolvedValue(undefined);
  });

  it('sends bytes only to the presigned PUT and bounds parallel uploads', async () => {
    const assets = createAssets(8);
    const presignedSignature = 'runtime-presigned-signature';
    let activeUploads = 0;
    let maximumActiveUploads = 0;

    mocks.makeRequest.mockImplementation(async (url, options) => {
      if (options?.method === 'PUT') {
        activeUploads += 1;
        maximumActiveUploads = Math.max(maximumActiveUploads, activeUploads);
        await new Promise((resolve) => setTimeout(resolve, 5));
        activeUploads -= 1;
        return [true, null, undefined];
      }

      if (!(url instanceof URL) && url.query?.type === 'uploadUrl') {
        return [
          true,
          null,
          {
            url:
              `https://uploads.example/${url.query.hash}` +
              `?X-Amz-Signature=${presignedSignature}`,
            contentType: 'application/octet-stream',
          },
        ];
      }

      return [true, null, undefined];
    });

    const logger = rs.fn();
    await awsUploadStrategy(
      {
        application_uid: 'app-id',
        application_configuration: Promise.resolve(appConfig),
        logger: Promise.resolve(logger),
      } as never,
      {
        snapshot: {} as never,
        getDashData: rs.fn(),
        assets,
      }
    );

    const presignCalls = mocks.makeRequest.mock.calls.filter(
      ([url]) => !(url instanceof URL) && url.query?.type === 'uploadUrl'
    );
    const putCalls = mocks.makeRequest.mock.calls.filter(
      ([, options]) => options?.method === 'PUT'
    );

    expect(presignCalls).toHaveLength(assets.missingAssets.length);
    expect(presignCalls.every((call) => call[2] === undefined)).toBe(true);
    expect(putCalls.every(([url]) => String(url).includes(presignedSignature))).toBe(
      true
    );
    expect(putCalls.map((call) => call[2])).toEqual(
      assets.missingAssets.map((asset) => asset.buffer)
    );
    expect(maximumActiveUploads).toBe(6);
  });
});
