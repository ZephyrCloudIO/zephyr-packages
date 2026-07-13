import { beforeEach, describe, expect, it, rs } from '@rstest/core';

import {
  ZEPHYR_MANIFEST_FILENAME,
  type ZeBuildAsset,
  type ZeBuildAssetsMap,
  type ZephyrBuildStats,
  type ZephyrBuildTarget,
  type ZephyrModuleFederationBuildMetadata,
  type ZephyrModuleFederationConfig,
} from 'zephyr-edge-contract';
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

function appConfig(): ZeApplicationConfig {
  return {
    application_uid: 'app.project.org',
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

function readyEngine(target: ZephyrBuildTarget = 'web'): ZephyrEngine {
  const engine = Object.create(ZephyrEngine.prototype) as ZephyrEngine;
  engine.application_uid = 'app.project.org';
  engine.applicationProperties = {
    org: 'org',
    project: 'project',
    name: 'app',
    version: '1.0.0',
  };
  engine.application_configuration = Promise.resolve(appConfig());
  engine.gitProperties = {
    git: {
      name: 'Developer',
      email: 'developer@example.test',
      branch: 'main',
      commit: 'abc123',
    },
  } as never;
  engine.env = { isCI: false, target, ssr: false };
  engine.buildProperties = { output: './dist' };
  engine.builder = 'rspack';
  engine.federated_dependencies = null;
  engine.build_id = Promise.resolve('build-1');
  engine.snapshotId = Promise.resolve('snapshot-1');
  engine.resolved_hash_list = { hash_set: new Set<string>() };
  return engine;
}

function asset(filepath: string, content: Buffer | string): ZeBuildAsset {
  return zeBuildAssets({ filepath, content });
}

function uploadedOptions(): UploadOptions {
  return mocks.uploadStrategy.mock.calls[0]?.[1] as UploadOptions;
}

function tapMetadata(
  name = 'desktop',
  remote = 'targets/desktop/remoteEntry.mjs'
): {
  mfConfigs: ZephyrModuleFederationConfig[];
  federation: ZephyrModuleFederationBuildMetadata[];
} {
  return {
    mfConfigs: [{ name, filename: remote }],
    federation: [{ name, remote }],
  };
}

describe('ZephyrEngine.upload_assets', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.uploadStrategy.mockResolvedValue('https://deploy.example.test/app');
    mocks.getUploadStrategy.mockReturnValue(mocks.uploadStrategy);
    mocks.setAppDeployResult.mockResolvedValue(undefined);
  });

  it('adds an empty zephyr manifest asset when no federated dependencies were resolved', async () => {
    const engine = readyEngine();
    const assetsMap: ZeBuildAssetsMap = {};

    await engine.upload_assets({
      assetsMap,
      buildStats: {} as never,
    });

    const manifestAsset = Object.values(assetsMap).find(
      (entry) => entry.path === ZEPHYR_MANIFEST_FILENAME
    );

    expect(manifestAsset).toBeDefined();
    expect(JSON.parse(manifestAsset?.buffer.toString('utf8') ?? '')).toMatchObject({
      version: '1.0.0',
      dependencies: {},
      zeVars: {},
    });
    expect(uploadedOptions().assets.assetsMap).toBe(assetsMap);
    expect(uploadedOptions().snapshot.assets).toHaveProperty(ZEPHYR_MANIFEST_FILENAME);
  });

  it('uploads emitted manifests and arbitrary TAP artifacts without rewriting bytes', async () => {
    const engine = readyEngine('tap-app');
    const metadata = tapMetadata();
    const manifestBytes = Buffer.from('{"source":"compilation","locked":true}');
    const descriptorBytes = Buffer.from('{"package":"tap-app","version":1}');
    const lockBytes = Buffer.from('{"assets":["icon.png"]}');
    const iconBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x01]);
    const emittedManifest = asset(ZEPHYR_MANIFEST_FILENAME, manifestBytes);
    const descriptor = asset('tap-package.json', descriptorBytes);
    const lock = asset('tap/asset-lock.json', lockBytes);
    const icon = asset('tap/assets/icon.png', iconBytes);
    const assetsMap = Object.freeze({
      [emittedManifest.hash]: emittedManifest,
      [descriptor.hash]: descriptor,
      [lock.hash]: lock,
      [icon.hash]: icon,
    }) as ZeBuildAssetsMap;
    const assetKeys = Object.keys(assetsMap);

    await engine.upload_assets({
      assetsMap,
      buildStats: { federation: metadata.federation } as ZephyrBuildStats,
      mfConfigs: metadata.mfConfigs,
    });

    const options = uploadedOptions();
    expect(mocks.getUploadStrategy).toHaveBeenCalledWith(UploadProviderType.CLOUDFLARE);
    expect(mocks.uploadStrategy).toHaveBeenCalledWith(engine, options);
    expect(mocks.setAppDeployResult).toHaveBeenCalledWith(
      engine.application_uid,
      expect.objectContaining({
        urls: ['https://deploy.example.test/app'],
        snapshot: options.snapshot,
      })
    );

    // Frozen BuildSession maps are shallow-cloned, but every validated artifact keeps
    // its original object, hash, path, size, and Buffer all the way to the strategy.
    expect(options.assets.assetsMap).not.toBe(assetsMap);
    expect(Object.keys(options.assets.assetsMap)).toEqual(assetKeys);
    for (const entry of [emittedManifest, descriptor, lock, icon]) {
      const uploaded = options.assets.assetsMap[entry.hash];
      expect(uploaded).toBe(entry);
      expect(uploaded?.buffer).toBe(entry.buffer);
      expect(Buffer.compare(uploaded?.buffer as Buffer, entry.buffer as Buffer)).toBe(0);
      expect(options.snapshot.assets[entry.path]).toEqual({
        path: entry.path,
        extname: entry.extname,
        hash: entry.hash,
        size: entry.size,
      });
    }
    expect(
      Object.values(options.assets.assetsMap).filter(
        (entry) => entry.path === ZEPHYR_MANIFEST_FILENAME
      )
    ).toEqual([emittedManifest]);
  });

  it('fails closed on incomplete, ambiguous, or mismatched TAP federation metadata', async () => {
    const desktop = tapMetadata('desktop', 'targets/desktop/remoteEntry.mjs');
    const mobile = tapMetadata('mobile', 'targets/mobile/remoteEntry.mjs');
    const cases: Array<{
      label: string;
      mfConfigs?: ZephyrModuleFederationConfig[];
      federation?: ZephyrModuleFederationBuildMetadata[];
      message: string;
    }> = [
      {
        label: 'missing arrays',
        message: 'requires a non-empty mfConfigs metadata array',
      },
      {
        label: 'empty arrays',
        mfConfigs: [],
        federation: [],
        message: 'requires a non-empty mfConfigs metadata array',
      },
      {
        label: 'different container counts',
        mfConfigs: [...desktop.mfConfigs, ...mobile.mfConfigs],
        federation: desktop.federation,
        message: 'must contain the same number of containers',
      },
      {
        label: 'duplicate federation remote',
        mfConfigs: [
          { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
          { name: 'mobile', filename: 'targets/mobile/remoteEntry.mjs' },
        ],
        federation: [
          { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' },
          { name: 'mobile', remote: 'targets/desktop/remoteEntry.mjs' },
        ],
        message: 'federation metadata entries must not duplicate names or remotes',
      },
      {
        label: 'duplicate snapshot config name',
        mfConfigs: [
          { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
          { name: 'desktop', filename: 'targets/mobile/remoteEntry.mjs' },
        ],
        federation: [
          { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' },
          { name: 'mobile', remote: 'targets/mobile/remoteEntry.mjs' },
        ],
        message: 'mfConfigs entries must not duplicate names or filenames',
      },
      {
        label: 'nonmatching name and remote pair',
        mfConfigs: desktop.mfConfigs,
        federation: [{ name: 'desktop', remote: 'targets/mobile/remoteEntry.mjs' }],
        message: 'has no matching name and remote',
      },
    ];

    for (const invalid of cases) {
      const engine = readyEngine('tap-app');
      await expect(
        engine.upload_assets({
          assetsMap: {},
          buildStats: { federation: invalid.federation } as ZephyrBuildStats,
          mfConfigs: invalid.mfConfigs,
        })
      ).rejects.toThrow(invalid.message);
      expect(mocks.uploadStrategy).not.toHaveBeenCalled();
    }
  });

  it('fails closed on duplicate emitted manifests instead of selecting the first one', async () => {
    const engine = readyEngine();
    const firstManifest = asset(ZEPHYR_MANIFEST_FILENAME, '{"build":1}');
    const secondManifest = asset(ZEPHYR_MANIFEST_FILENAME, '{"build":2}');
    const assetsMap: ZeBuildAssetsMap = {
      [firstManifest.hash]: firstManifest,
      [secondManifest.hash]: secondManifest,
    };

    await expect(
      engine.upload_assets({
        assetsMap,
        buildStats: {} as never,
      })
    ).rejects.toThrow('Ambiguous asset path "zephyr-manifest.json"');

    expect(mocks.getUploadStrategy).not.toHaveBeenCalled();
    expect(mocks.uploadStrategy).not.toHaveBeenCalled();
    expect(mocks.setAppDeployResult).not.toHaveBeenCalled();
    expect(engine.build_id).toBeNull();
  });

  it('rejects a noncanonical path before it can alias a locked TAP asset', async () => {
    const engine = readyEngine('tap-app');
    const metadata = tapMetadata();
    const posixLock = asset('tap/asset-lock.json', '{"platform":"posix"}');
    const windowsLock = asset('tap\\asset-lock.json', '{"platform":"windows"}');
    const assetsMap: ZeBuildAssetsMap = {
      [posixLock.hash]: posixLock,
      [windowsLock.hash]: windowsLock,
    };

    await expect(
      engine.upload_assets({
        assetsMap,
        buildStats: { federation: metadata.federation } as ZephyrBuildStats,
        mfConfigs: metadata.mfConfigs,
      })
    ).rejects.toThrow('Asset path must use its canonical snapshot spelling');

    expect(mocks.getUploadStrategy).not.toHaveBeenCalled();
    expect(mocks.uploadStrategy).not.toHaveBeenCalled();
    expect(Object.values(assetsMap)).toEqual([posixLock, windowsLock]);
  });

  it('rejects manifest aliases and escaping paths instead of generating a second manifest', async () => {
    const metadata = tapMetadata();
    const invalidPaths = [
      './zephyr-manifest.json',
      'tap//asset-lock.json',
      'tap/../asset-lock.json',
      '/tap/asset-lock.json',
      'C:\\tap\\asset-lock.json',
      'https://example.test/tap/asset-lock.json',
      `tap/asset\0-lock.json`,
    ];

    for (const path of invalidPaths) {
      const engine = readyEngine('tap-app');
      const invalidAsset = asset(path, 'locked');
      const assetsMap: ZeBuildAssetsMap = { [invalidAsset.hash]: invalidAsset };

      await expect(
        engine.upload_assets({
          assetsMap,
          buildStats: { federation: metadata.federation } as ZephyrBuildStats,
          mfConfigs: metadata.mfConfigs,
        })
      ).rejects.toThrow(
        /Asset path must (use its canonical snapshot spelling|be a relative snapshot path|not escape the snapshot root)/
      );

      expect(mocks.uploadStrategy).not.toHaveBeenCalled();
      expect(Object.values(assetsMap)).toEqual([invalidAsset]);
      rs.clearAllMocks();
      mocks.getUploadStrategy.mockReturnValue(mocks.uploadStrategy);
      mocks.uploadStrategy.mockResolvedValue('https://deploy.example.test/app');
      mocks.setAppDeployResult.mockResolvedValue(undefined);
    }
  });

  it('normalizes native asset separators for conventional adapter uploads', async () => {
    const engine = readyEngine();
    const nativePathAsset = asset('assets\\.gitkeep', '');
    const assetsMap: ZeBuildAssetsMap = {
      [nativePathAsset.hash]: nativePathAsset,
    };

    await engine.upload_assets({
      assetsMap,
      buildStats: {} as never,
    });

    const options = uploadedOptions();
    expect(options.assets.assetsMap[nativePathAsset.hash]).toBe(nativePathAsset);
    expect(options.assets.assetsMap[nativePathAsset.hash]?.path).toBe('assets\\.gitkeep');
    expect(options.snapshot.assets['assets/.gitkeep']).toEqual({
      path: 'assets/.gitkeep',
      extname: nativePathAsset.extname,
      hash: nativePathAsset.hash,
      size: nativePathAsset.size,
    });
  });
});
