import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { ZeBuildAsset, ZeBuildAssetsMap } from 'zephyr-edge-contract';

const mocks = rs.hoisted(() => ({
  getApplicationConfiguration: rs.fn(),
  makeRequest: rs.fn(),
  updateHashList: rs.fn(),
  zeUploadSnapshot: rs.fn(),
  fallbackUploadAssets: rs.fn(),
  fallbackUploadAssetsToEdge: rs.fn(),
  uploadBuildStatsAndEnableEnvs: rs.fn(),
  // Pass-through of the shared handler: restore the reported assets via the strategy.
  createMissingAssetsHandler: rs.fn(
    (
      _engine: unknown,
      {
        assetsMap,
        uploadAssetsToEdge,
      }: {
        assetsMap: Record<string, unknown>;
        uploadAssetsToEdge: (assets: unknown[], edgeUrl: string) => Promise<void>;
      }
    ) =>
      ({ hashes, edgeUrl }: { hashes: string[]; edgeUrl: string }) =>
        uploadAssetsToEdge(
          hashes.map((hash) => assetsMap[hash]),
          edgeUrl
        )
  ),
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
  createMissingAssetsHandler: mocks.createMissingAssetsHandler,
  uploadAssets: mocks.fallbackUploadAssets,
  uploadAssetsToEdge: mocks.fallbackUploadAssetsToEdge,
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

  describe('snapshot missing assets recovery', () => {
    const ENV_EDGE_URL = 'https://environment.edge.example';

    function engine() {
      return {
        application_uid: 'app-id',
        application_configuration: Promise.resolve(appConfig),
        logger: Promise.resolve(rs.fn()),
      } as never;
    }

    beforeEach(() => {
      // Snapshot upload reports hash-1 as removed by retention on an environment edge.
      mocks.zeUploadSnapshot.mockImplementation(
        async (
          _engine: unknown,
          {
            onMissingAssets,
          }: {
            onMissingAssets: (missing: {
              hashes: string[];
              edgeUrl: string;
            }) => Promise<void>;
          }
        ) => {
          await onMissingAssets({ hashes: ['hash-1'], edgeUrl: ENV_EDGE_URL });
          return 'https://edge.example/version';
        }
      );
    });

    it('re-uploads reported assets through presigned URLs of the rejecting edge', async () => {
      const assets = createAssets(3);
      mocks.makeRequest.mockImplementation(async (url) => {
        if (!(url instanceof URL) && url.query?.type === 'uploadUrl') {
          return [
            true,
            null,
            {
              url: `https://uploads.example/${url.query.hash}`,
              contentType: 'application/octet-stream',
            },
          ];
        }
        return [true, null, undefined];
      });

      await expect(
        awsUploadStrategy(engine(), {
          snapshot: {} as never,
          getDashData: rs.fn(),
          assets: { assetsMap: assets.assetsMap, missingAssets: [] },
        })
      ).resolves.toBe('https://edge.example/version');

      const presignCalls = mocks.makeRequest.mock.calls.filter(
        ([url]) => !(url instanceof URL) && url.query?.type === 'uploadUrl'
      );
      expect(presignCalls).toHaveLength(1);
      expect(presignCalls[0]?.[0]).toMatchObject({
        base: ENV_EDGE_URL,
        query: { hash: 'hash-1' },
      });
      const putCalls = mocks.makeRequest.mock.calls.filter(
        ([, options]) => options?.method === 'PUT'
      );
      expect(putCalls.map((call) => call[2])).toEqual([
        assets.assetsMap['hash-1']?.buffer,
      ]);
      expect(mocks.fallbackUploadAssetsToEdge).not.toHaveBeenCalled();
    });

    it('falls back to direct file uploads when presigned URLs are not implemented', async () => {
      const assets = createAssets(2);
      mocks.fallbackUploadAssetsToEdge.mockResolvedValue(undefined);
      mocks.makeRequest.mockImplementation(async (url) => {
        if (!(url instanceof URL) && url.query?.type === 'uploadUrl') {
          return [false, { template: { content: 'Not Implemented' } }];
        }
        return [true, null, undefined];
      });

      await awsUploadStrategy(engine(), {
        snapshot: {} as never,
        getDashData: rs.fn(),
        assets: { assetsMap: assets.assetsMap, missingAssets: [] },
      });

      expect(mocks.fallbackUploadAssetsToEdge).toHaveBeenCalledWith(
        expect.anything(),
        [assets.assetsMap['hash-1']],
        ENV_EDGE_URL
      );
    });
  });
});
