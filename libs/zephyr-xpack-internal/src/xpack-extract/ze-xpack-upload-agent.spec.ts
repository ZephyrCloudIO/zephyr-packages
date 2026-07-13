import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';

import { xpack_zephyr_agent } from './ze-xpack-upload-agent';
import { buildWebpackAssetMap } from './build-webpack-assets-map';
import {
  getBuildStats,
  getModuleFederationConfigs,
} from '../federation-dashboard-legacy/get-build-stats';
import { emitDeploymentDone } from '../lifecycle-events/index';
import { handleGlobalError, zeBuildAssets, ze_log } from 'zephyr-agent';

rs.mock('./build-webpack-assets-map', () => ({
  buildWebpackAssetMap: rs.fn(),
}));

rs.mock('../federation-dashboard-legacy/get-build-stats', () => ({
  getBuildStats: rs.fn(),
  getModuleFederationConfigs: rs.fn(),
}));

rs.mock('../lifecycle-events/index', () => ({
  emitDeploymentDone: rs.fn(),
}));

rs.mock('zephyr-agent', () => ({
  assertTapFederationPublicationMetadata: rs.fn(),
  handleGlobalError: rs.fn(),
  zeBuildAssets: rs.fn(({ filepath, content }) => ({
    path: filepath,
    hash: `rehash:${filepath}`,
    extname: '.js',
    size: Buffer.byteLength(content),
    buffer: content,
  })),
  ze_log: {
    init: rs.fn(),
    upload: rs.fn(),
  },
}));

describe('xpack_zephyr_agent', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    (getModuleFederationConfigs as Mock).mockReturnValue([]);
  });

  it('preserves the legacy single config alongside the multi-config snapshot contract', async () => {
    const mfConfig = {
      name: 'desktop',
      filename: 'targets/desktop/remoteEntry.mjs',
      library: { type: 'module' },
    };
    const uploadAssets = rs.fn().mockResolvedValue(undefined);
    (buildWebpackAssetMap as Mock).mockResolvedValue({});
    (getBuildStats as Mock).mockResolvedValue({});
    (getModuleFederationConfigs as Mock).mockReturnValue([mfConfig]);

    await xpack_zephyr_agent({
      stats: {},
      stats_json: {},
      assets: {},
      pluginOptions: {
        zephyr_engine: {
          application_configuration: Promise.resolve({
            EDGE_URL: 'edge',
            PLATFORM: 'web',
            DELIMITER: '.',
          }),
          upload_assets: uploadAssets,
          build_finished: rs.fn().mockResolvedValue(undefined),
        },
      },
    } as never);

    expect(uploadAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        mfConfig,
        mfConfigs: [mfConfig],
      })
    );
  });

  it('preserves SDK-locked TAP paths, hashes, and bytes despite a compiler asset prefix', async () => {
    const contribute = rs.fn().mockResolvedValue(false);
    const lockedAssets = {
      'sdk-descriptor-hash': {
        path: 'manifest.tap.json',
        hash: 'sdk-descriptor-hash',
        extname: '.json',
        size: 20,
        buffer: Buffer.from('{"locked":true}'),
      },
      'sdk-entry-hash': {
        path: 'targets/desktop/remoteEntry.mjs',
        hash: 'sdk-entry-hash',
        extname: '.mjs',
        size: 15,
        buffer: Buffer.from('signed entry'),
      },
    };
    const buildProperties = { output: './dist', baseHref: '/local-output/' };
    (buildWebpackAssetMap as Mock).mockResolvedValue(lockedAssets);
    (getBuildStats as Mock).mockResolvedValue({});

    await xpack_zephyr_agent({
      stats: {},
      stats_json: {},
      assets: {},
      pluginOptions: {
        zephyr_engine: {
          env: { target: 'tap-app' },
          buildProperties,
          application_configuration: Promise.resolve({
            EDGE_URL: 'edge',
            PLATFORM: 'web',
            DELIMITER: '.',
          }),
        },
        coordinator: { contribute },
        participant: 'desktop',
        assetPrefix: 'local-output/desktop',
      },
    } as never);

    expect(buildProperties.baseHref).toBe('');
    expect(contribute).toHaveBeenCalledWith(
      expect.objectContaining({ assetsMap: lockedAssets })
    );
    expect(contribute.mock.calls[0]?.[0].assetsMap).toBe(lockedAssets);
    expect(zeBuildAssets).not.toHaveBeenCalled();
    expect(lockedAssets['sdk-descriptor-hash'].buffer).toEqual(
      Buffer.from('{"locked":true}')
    );
    expect(lockedAssets['sdk-entry-hash'].buffer).toEqual(Buffer.from('signed entry'));
  });

  it('keeps direct TAP uploads package-relative without re-keying assets', async () => {
    const lockedAssets = {
      'sdk-lock-hash': {
        path: 'targets/worker/remoteEntry.mjs',
        hash: 'sdk-lock-hash',
        extname: '.mjs',
        size: 12,
        buffer: Buffer.from('worker entry'),
      },
    };
    const uploadAssets = rs.fn().mockResolvedValue(undefined);
    const buildProperties = { output: './dist', baseHref: '/local-output/' };
    (buildWebpackAssetMap as Mock).mockResolvedValue(lockedAssets);
    (getBuildStats as Mock).mockResolvedValue({});

    await xpack_zephyr_agent({
      stats: {},
      stats_json: {},
      assets: {},
      pluginOptions: {
        zephyr_engine: {
          env: { target: 'tap-app' },
          buildProperties,
          application_configuration: Promise.resolve({
            EDGE_URL: 'edge',
            PLATFORM: 'web',
            DELIMITER: '.',
          }),
          upload_assets: uploadAssets,
          build_finished: rs.fn().mockResolvedValue(undefined),
        },
        assetPrefix: 'local-output/worker',
        wait_for_index_html: true,
      },
    } as never);

    expect(buildWebpackAssetMap).toHaveBeenCalledWith(
      {},
      {
        wait_for_index_html: false,
        failOnUnsupportedSource: true,
      }
    );
    expect(buildProperties.baseHref).toBe('');
    expect(uploadAssets).toHaveBeenCalledWith(
      expect.objectContaining({ assetsMap: lockedAssets })
    );
    expect(uploadAssets.mock.calls[0]?.[0].assetsMap).toBe(lockedAssets);
    expect(zeBuildAssets).not.toHaveBeenCalled();
  });

  it('delegates failures to handleGlobalError', async () => {
    const error = new Error('upload failed');
    const buildFailed = rs.fn();
    (buildWebpackAssetMap as Mock).mockRejectedValue(error);

    await xpack_zephyr_agent({
      stats: {},
      stats_json: {},
      assets: {},
      pluginOptions: {
        zephyr_engine: { build_failed: buildFailed },
      },
    } as never);

    expect(buildFailed).toHaveBeenCalledTimes(1);
    expect(handleGlobalError).toHaveBeenCalledWith(error);
    expect(emitDeploymentDone).toHaveBeenCalled();
    expect(ze_log.upload).toHaveBeenCalled();
    expect(getBuildStats).not.toHaveBeenCalled();
  });

  it('rethrows when handleGlobalError throws', async () => {
    const error = new Error('upload failed');
    const buildFailed = rs.fn();
    (buildWebpackAssetMap as Mock).mockRejectedValue(error);
    (handleGlobalError as Mock).mockImplementation(() => {
      throw error;
    });

    await expect(
      xpack_zephyr_agent({
        stats: {},
        stats_json: {},
        assets: {},
        pluginOptions: {
          zephyr_engine: { build_failed: buildFailed },
        },
      } as never)
    ).rejects.toThrow('upload failed');

    expect(buildFailed).toHaveBeenCalledTimes(1);
    expect(emitDeploymentDone).toHaveBeenCalled();
    expect(ze_log.upload).toHaveBeenCalled();
  });

  it('rehashes prefixed assets and propagates coordinated publication failures', async () => {
    const error = new Error('coordinated upload failed');
    const contribute = rs.fn().mockRejectedValue(error);
    (buildWebpackAssetMap as Mock).mockResolvedValue({
      original: {
        path: 'app.js',
        hash: 'original',
        extname: '.js',
        size: 1,
        buffer: 'x',
      },
    });
    (getBuildStats as Mock).mockResolvedValue({});

    await expect(
      xpack_zephyr_agent({
        stats: {},
        stats_json: {},
        assets: {},
        pluginOptions: {
          zephyr_engine: {
            application_configuration: Promise.resolve({
              EDGE_URL: 'edge',
              PLATFORM: 'web',
              DELIMITER: '.',
            }),
          },
          coordinator: { contribute },
          participant: 'client',
          generation: 3,
          assetPrefix: 'client',
        },
      } as never)
    ).rejects.toThrow('coordinated upload failed');

    expect(contribute).toHaveBeenCalledWith(
      expect.objectContaining({
        participant: 'client',
        generation: 3,
        assetsMap: {
          'rehash:client/app.js': expect.objectContaining({
            path: 'client/app.js',
          }),
        },
      })
    );
    expect(handleGlobalError).not.toHaveBeenCalled();
    expect(emitDeploymentDone).not.toHaveBeenCalled();
  });
});
