import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { ZeBuildAsset, ZeBuildAssetsMap } from 'zephyr-edge-contract';

// Only the network is mocked: the strategy, makeRequest and fetchWithRetries are real, so
// this checks which headers each upload request would actually send.
const mocks = rs.hoisted(() => ({
  axiosInstance: rs.fn(),
  getApplicationConfiguration: rs.fn(),
  updateHashList: rs.fn(),
  zeUploadSnapshot: rs.fn(),
  uploadBuildStatsAndEnableEnvs: rs.fn(),
}));

rs.mock('axios', () => ({ default: { create: () => mocks.axiosInstance } }));
rs.mock('ci-info', () => ({ isCI: false }));
rs.mock('../edge-requests/get-application-configuration', () => ({
  getApplicationConfiguration: mocks.getApplicationConfiguration,
}));
rs.mock('../node-persist/token', () => ({ cleanTokens: rs.fn() }));
rs.mock('../logging', () => ({
  ze_log: { snapshot: rs.fn(), upload: rs.fn(), error: rs.fn(), http: rs.fn() },
}));
rs.mock('../logging/ze-log-event', () => ({ logFn: rs.fn() }));
rs.mock('../edge-hash-list/distributed-hash-control', () => ({
  update_hash_list: mocks.updateHashList,
}));
rs.mock('../edge-actions', () => ({ zeUploadSnapshot: mocks.zeUploadSnapshot }));
rs.mock('./upload-base', () => ({
  uploadAssets: rs.fn(),
  uploadBuildStatsAndEnableEnvs: mocks.uploadBuildStatsAndEnableEnvs,
}));

import { withRequestIdentity } from '../http/request-identity';
import { awsUploadStrategy } from './aws-upload.strategy';

const EDGE_URL = 'https://edge.example';
const PRESIGNED_HOST = 'https://bucket.s3.us-east-1.amazonaws.com';

function createAssets(): { assetsMap: ZeBuildAssetsMap; missingAssets: ZeBuildAsset[] } {
  const missingAssets = [10, 30, 20].map((length, index) => {
    const buffer = Buffer.alloc(length, index);
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

function headerNames(headers: Record<string, string> | undefined): string[] {
  return Object.keys(headers ?? {}).map((name) => name.toLowerCase());
}

describe('awsUploadStrategy request identity', () => {
  const appConfig = { application_uid: 'app-id', EDGE_URL, jwt: 'write-token' };

  beforeEach(() => {
    rs.clearAllMocks();
    mocks.getApplicationConfiguration.mockResolvedValue(appConfig);
    mocks.zeUploadSnapshot.mockResolvedValue(`${EDGE_URL}/version`);
    mocks.uploadBuildStatsAndEnableEnvs.mockResolvedValue(undefined);
    mocks.updateHashList.mockResolvedValue(undefined);
    mocks.axiosInstance.mockImplementation(async (url: string) => {
      const parsed = new URL(url);
      if (parsed.searchParams.get('type') === 'uploadUrl') {
        return {
          status: 200,
          headers: {},
          data: {
            url: `${PRESIGNED_HOST}/${parsed.searchParams.get('hash')}?X-Amz-Signature=sig`,
            contentType: 'application/octet-stream',
          },
        };
      }
      return { status: 200, headers: {}, data: 'ok' };
    });
  });

  it('identifies the build to the Zephyr edge and nothing to the presigned PUT', async () => {
    const assets = createAssets();
    const logger = rs.fn();

    await withRequestIdentity(
      {
        buildId: '11887',
        builder: 'webpack',
        plugin: 'zephyr-webpack-plugin',
        pluginVersion: '1.8.0',
        zephyrOrigins: [EDGE_URL],
      },
      () =>
        awsUploadStrategy(
          {
            application_uid: 'app-id',
            application_configuration: Promise.resolve(appConfig),
            logger: Promise.resolve(logger),
          } as never,
          { snapshot: {} as never, getDashData: rs.fn(), assets }
        )
    );

    const calls = mocks.axiosInstance.mock.calls.map(([url, config]) => ({
      url: String(url),
      method: config.method,
      headers: config.headers as Record<string, string> | undefined,
    }));
    const edgeCalls = calls.filter((call) => call.url.startsWith(EDGE_URL));
    const presignedPuts = calls.filter((call) => call.url.startsWith(PRESIGNED_HOST));

    // The bucket call and one upload-URL request per asset.
    expect(edgeCalls).toHaveLength(1 + assets.missingAssets.length);
    for (const call of edgeCalls) {
      expect(call.headers?.['x-ze-build-id']).toBe('11887');
      expect(call.headers?.['User-Agent']).toMatch(
        /^zephyr-agent\/\S+ \(webpack; zephyr-webpack-plugin\/1\.8\.0; node\/\S+\)$/
      );
    }

    expect(presignedPuts).toHaveLength(assets.missingAssets.length);
    for (const put of presignedPuts) {
      expect(put.method).toBe('PUT');
      expect(headerNames(put.headers)).not.toContain('user-agent');
      expect(headerNames(put.headers)).not.toContain('x-ze-build-id');
      expect(put.headers).toEqual({ 'Content-Type': 'application/octet-stream' });
    }

    // The upload summary carries the numbers the console sentence shows.
    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'snapshot:assets:upload:done',
        data: {
          assets_uploaded: 3,
          assets_total: 3,
          bytes: 60,
          duration_ms: expect.any(Number),
          outcome: 'uploaded',
          largest_assets: [
            { path: 'assets/1.js', bytes: 30 },
            { path: 'assets/2.js', bytes: 20 },
            { path: 'assets/0.js', bytes: 10 },
          ],
        },
      })
    );
  });
});
