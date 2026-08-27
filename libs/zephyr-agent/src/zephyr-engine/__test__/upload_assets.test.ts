import { beforeEach, describe, expect, it, rs } from '@rstest/core';

import {
  ZEPHYR_MANIFEST_FILENAME,
  type ZeBuildAsset,
  type ZeBuildAssetsMap,
  type ZephyrBuildTarget,
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

  it('uploads the tap-app target without target-specific Federation metadata', async () => {
    const engine = readyEngine('tap-app');
    const app = asset('index.html', '<main>app</main>');
    const assetsMap: ZeBuildAssetsMap = { [app.hash]: app };

    await engine.upload_assets({
      assetsMap,
      buildStats: {} as never,
      mfConfigs: [],
    });

    expect(uploadedOptions().snapshot).toMatchObject({
      target: 'tap-app',
      mfConfigs: [],
    });
    expect(mocks.uploadStrategy).toHaveBeenCalledOnce();
  });

  it('uploads emitted manifests and arbitrary assets without rewriting bytes', async () => {
    const engine = readyEngine();
    const manifestBytes = Buffer.from('{"source":"compilation"}');
    const metadataBytes = Buffer.from('{"application":"example","version":1}');
    const indexBytes = Buffer.from('{"assets":["icon.png"]}');
    const iconBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x01]);
    const emittedManifest = asset(ZEPHYR_MANIFEST_FILENAME, manifestBytes);
    const metadata = asset('application.json', metadataBytes);
    const index = asset('assets/index.json', indexBytes);
    const icon = asset('assets/icon.png', iconBytes);
    const assetsMap = Object.freeze({
      [emittedManifest.hash]: emittedManifest,
      [metadata.hash]: metadata,
      [index.hash]: index,
      [icon.hash]: icon,
    }) as ZeBuildAssetsMap;
    const assetKeys = Object.keys(assetsMap);

    await engine.upload_assets({
      assetsMap,
      buildStats: {} as never,
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

    // Frozen BuildSession maps are shallow-cloned, but every asset keeps
    // its original object, hash, path, size, and Buffer all the way to the strategy.
    expect(options.assets.assetsMap).not.toBe(assetsMap);
    expect(Object.keys(options.assets.assetsMap)).toEqual(assetKeys);
    for (const entry of [emittedManifest, metadata, index, icon]) {
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
