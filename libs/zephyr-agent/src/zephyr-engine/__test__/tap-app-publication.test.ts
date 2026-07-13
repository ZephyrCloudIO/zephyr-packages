import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ZeBuildAssetsMap, ZephyrBuildStats } from 'zephyr-edge-contract';
import type { ZeApplicationConfig } from '../../lib/node-persist/upload-provider-options';
import { UploadProviderType } from '../../lib/node-persist/upload-provider-options';
import { zeBuildAssets } from '../../lib/transformers/ze-build-assets';
import { ZephyrEngine, type UploadOptions } from '../index';

const mocks = rs.hoisted(() => ({
  getUploadStrategy: rs.fn(),
  uploadStrategy: rs.fn(),
  setAppDeployResult: rs.fn(),
}));

rs.mock('../../lib/deployment/get-upload-strategy', () => ({
  getUploadStrategy: mocks.getUploadStrategy,
}));

rs.mock('../../lib/node-persist/app-deploy-result-cache', () => ({
  setAppDeployResult: mocks.setAppDeployResult,
}));

function applicationConfiguration(): ZeApplicationConfig {
  return {
    application_uid: 'tap.example.org',
    BUILD_ID_ENDPOINT: '/build-id',
    EDGE_URL: 'https://edge.example.test',
    DELIMITER: '-',
    ADDRESS_MODE: 'hostname',
    PLATFORM: UploadProviderType.CLOUDFLARE,
    email: 'developer@example.test',
    jwt: 'test-jwt',
    user_uuid: 'user-id',
    username: 'developer',
  };
}

function engine(): ZephyrEngine {
  const instance = Object.create(ZephyrEngine.prototype) as ZephyrEngine;
  instance.application_uid = 'tap.example.org';
  instance.applicationProperties = {
    org: 'org',
    project: 'example',
    name: 'tap',
    version: '1.0.0',
  };
  instance.application_configuration = Promise.resolve(applicationConfiguration());
  instance.gitProperties = {
    git: {
      name: 'Developer',
      email: 'developer@example.test',
      branch: 'main',
      commit: 'abc123',
    },
  } as never;
  instance.env = { isCI: false, target: 'tap-app', ssr: false };
  instance.buildProperties = { output: './dist' };
  instance.builder = 'rspack';
  instance.federated_dependencies = null;
  instance.build_id = Promise.resolve('build-1');
  instance.snapshotId = Promise.resolve('snapshot-1');
  instance.resolved_hash_list = { hash_set: new Set<string>() };
  return instance;
}

function asset(path: string, content: string | Buffer) {
  return zeBuildAssets({ filepath: path, content });
}

const TAP_FIXTURE_ROOT = join(__dirname, '__fixtures__/tap-app-package');

function fixtureAsset(relativePath: string) {
  return asset(relativePath, readFileSync(join(TAP_FIXTURE_ROOT, relativePath)));
}

describe('tap-app publication contract', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.getUploadStrategy.mockReturnValue(mocks.uploadStrategy);
    mocks.uploadStrategy.mockResolvedValue('https://deploy.example.test/tap');
    mocks.setAppDeployResult.mockResolvedValue(undefined);
  });

  it('preserves the reusable desktop, mobile, and background conformance fixture exactly', async () => {
    const publicationEngine = engine();
    const descriptor = fixtureAsset('manifest.tap.json');
    const lock = fixtureAsset('tap.graph.lock.json');
    const emittedManifest = fixtureAsset('zephyr-manifest.json');
    const desktopEntry = fixtureAsset('targets/desktop/remoteEntry.mjs');
    const mobileEntry = fixtureAsset('targets/mobile/remoteEntry.mjs');
    const backgroundEntry = fixtureAsset('targets/quickjs/remoteEntry.mjs');
    const desktopManifest = fixtureAsset('targets/desktop/mf-manifest.json');
    const svgIcon = fixtureAsset('assets/app-icon.svg');
    const icon = asset('assets/app-icon.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const assets = [
      descriptor,
      lock,
      emittedManifest,
      desktopEntry,
      mobileEntry,
      backgroundEntry,
      desktopManifest,
      svgIcon,
      icon,
    ];
    const assetsMap = Object.fromEntries(assets.map((item) => [item.hash, item]));
    const mfConfigs = [
      {
        name: 'desktop',
        filename: 'targets/desktop/remoteEntry.mjs',
        library: { type: 'module' },
        manifest: { filePath: 'targets/desktop', fileName: 'mf-manifest' },
        exposes: { './ui': './src/desktop.ts' },
      },
      {
        name: 'mobile',
        filename: 'targets/mobile/remoteEntry.mjs',
        library: { type: 'module' },
        exposes: { './ui': './src/mobile.ts' },
      },
      {
        name: 'quickjs',
        filename: 'targets/quickjs/remoteEntry.mjs',
        library: { type: 'module' },
        exposes: { './background': './src/background.ts' },
      },
    ];
    const buildStats = {
      federation: [
        {
          name: 'desktop',
          remote: 'targets/desktop/remoteEntry.mjs',
          mf_manifest: 'targets/desktop/mf-manifest.json',
          library_type: 'module',
        },
        {
          name: 'mobile',
          remote: 'targets/mobile/remoteEntry.mjs',
          library_type: 'module',
        },
        {
          name: 'quickjs',
          remote: 'targets/quickjs/remoteEntry.mjs',
          library_type: 'module',
        },
      ],
    } as ZephyrBuildStats;

    await publicationEngine.upload_assets({
      assetsMap,
      buildStats,
      mfConfigs,
    });

    const options = mocks.uploadStrategy.mock.calls[0]?.[1] as UploadOptions;
    expect(options.snapshot.mfConfigs).toEqual(mfConfigs);
    expect(options.getDashData().federation).toEqual(buildStats.federation);
    expect(options.assets.assetsMap).toBe(assetsMap as ZeBuildAssetsMap);
    for (const original of assets) {
      expect(options.assets.assetsMap[original.hash]).toBe(original);
      expect(options.snapshot.assets[original.path]).toEqual({
        path: original.path,
        extname: original.extname,
        hash: original.hash,
        size: original.size,
      });
    }
  });

  it('fails closed when the descriptor-drift fixture competes for the locked path', async () => {
    const publicationEngine = engine();
    const validatedDescriptor = fixtureAsset('manifest.tap.json');
    const driftedDescriptor = asset(
      'manifest.tap.json',
      readFileSync(
        join(__dirname, '__fixtures__/tap-app-descriptor-drift/manifest.tap.json')
      )
    );

    await expect(
      publicationEngine.upload_assets({
        assetsMap: {
          [validatedDescriptor.hash]: validatedDescriptor,
          [driftedDescriptor.hash]: driftedDescriptor,
        },
        buildStats: {
          federation: [{ name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' }],
        } as ZephyrBuildStats,
        mfConfigs: [{ name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' }],
      })
    ).rejects.toThrow('Ambiguous asset path "manifest.tap.json"');

    expect(mocks.uploadStrategy).not.toHaveBeenCalled();
  });
});
