import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { ZeBuildAsset, ZeBuildAssetsMap } from 'zephyr-edge-contract';

const mocks = rs.hoisted(() => ({
  getApplicationHashList: rs.fn(),
  uploadFile: rs.fn(),
}));

rs.mock('../edge-requests/get-application-hash-list', () => ({
  getApplicationHashList: mocks.getApplicationHashList,
}));
rs.mock('../http/upload-file', () => ({ uploadFile: mocks.uploadFile }));
rs.mock('../logging', () => ({ ze_log: { upload: rs.fn() } }));

import { zeUploadAssets } from './ze-upload-assets';

function createAssets(count: number): {
  assetsMap: ZeBuildAssetsMap;
  assets: ZeBuildAsset[];
} {
  const assets = Array.from({ length: count }, (_, index) => {
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
    assets,
    assetsMap: Object.fromEntries(assets.map((asset) => [asset.hash, asset])),
  };
}

function createEngine(environmentCount: number) {
  return {
    application_uid: 'app-id',
    logger: Promise.resolve(rs.fn()),
    application_configuration: Promise.resolve({
      application_uid: 'app-id',
      EDGE_URL: 'https://primary.edge.example',
      jwt: 'write-token',
      ENVIRONMENTS: Object.fromEntries(
        Array.from({ length: environmentCount }, (_, index) => [
          `environment-${index}`,
          { edgeUrl: `https://environment-${index}.edge.example` },
        ])
      ),
    }),
  } as never;
}

describe('zeUploadAssets environment fanout', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('bounds concurrent environment hash-list requests', async () => {
    let activeRequests = 0;
    let maximumActiveRequests = 0;
    mocks.getApplicationHashList.mockImplementation(async () => {
      activeRequests += 1;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeRequests -= 1;
      return { hashes: [] };
    });

    await zeUploadAssets(createEngine(7), { missingAssets: [], assetsMap: {} });

    expect(mocks.getApplicationHashList).toHaveBeenCalledTimes(7);
    expect(maximumActiveRequests).toBe(3);
  });

  it('bounds missing-asset uploads within each environment', async () => {
    const { assetsMap } = createAssets(8);
    let activeUploads = 0;
    let maximumActiveUploads = 0;
    mocks.getApplicationHashList.mockResolvedValue({ hashes: [] });
    mocks.uploadFile.mockImplementation(async () => {
      activeUploads += 1;
      maximumActiveUploads = Math.max(maximumActiveUploads, activeUploads);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeUploads -= 1;
    });

    await zeUploadAssets(createEngine(1), { missingAssets: [], assetsMap });

    expect(mocks.uploadFile).toHaveBeenCalledTimes(8);
    expect(maximumActiveUploads).toBe(6);
  });
});
