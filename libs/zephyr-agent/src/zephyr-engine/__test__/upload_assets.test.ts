import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureSource, loadSourceRecord } from '../../lib/change-attribution/source';

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
  getToken: rs.fn(),
  makeRequest: rs.fn(),
}));
rs.mock('../../lib/node-persist/token', () => ({ getToken: mocks.getToken }));
rs.mock('../../lib/http/http-request', () => ({ makeRequest: mocks.makeRequest }));

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
    mocks.getToken.mockResolvedValue('test-token');
    mocks.makeRequest.mockImplementation(async (_url, _options, body) => {
      const payload = JSON.parse(body);
      return [
        true,
        null,
        {
          status: 'ok',
          recordId: 'record-1',
          applicationUid: payload.applicationUid,
          repositoryId: payload.repositoryId,
          buildId: payload.buildId,
          snapshotId: payload.snapshotId,
          sourceFingerprint: payload.attribution.sourceFingerprint,
        },
      ];
    });
  });

  it('keeps local attribution out of snapshots and build stats without changing the deployer', async () => {
    const root = mkdtempSync(join(tmpdir(), 'zephyr-upload-attribution-'));
    try {
      execFileSync('git', ['init', '-q', root]);
      mkdirSync(join(root, '.zephyr'));
      writeFileSync(
        join(root, '.zephyr', 'attribution.json'),
        '{"schemaVersion":1,"enabled":true}'
      );
      writeFileSync(join(root, 'app.txt'), 'local source\n');
      const engine = readyEngine();
      engine.sourceContext = root;
      engine.sourceCapture = captureSource(root, 'build-start');
      await engine.upload_assets({ assetsMap: {}, buildStats: {} as never });
      const options = uploadedOptions();
      expect(options.snapshot.changeAttribution).toBeUndefined();
      expect(options.getDashData(engine).changeAttribution).toBeUndefined();
      expect(mocks.getToken).not.toHaveBeenCalled();
      expect(mocks.makeRequest).not.toHaveBeenCalled();
      expect(
        loadSourceRecord(root, options.snapshot.snapshot_id).files['app.txt']
      ).toBeTruthy();
      expect(options.snapshot.creator).toEqual({
        name: 'developer',
        email: 'developer@example.test',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('uploads remote evidence tied to the real build before publishing only its reference', async () => {
    const root = mkdtempSync(join(tmpdir(), 'zephyr-upload-remote-'));
    try {
      execFileSync('git', ['init', '-q', root]);
      mkdirSync(join(root, '.zephyr'));
      writeFileSync(
        join(root, '.zephyr/attribution.json'),
        '{"schemaVersion":1,"enabled":true,"storage":"remote"}'
      );
      writeFileSync(join(root, 'app.txt'), 'remote source\n');
      const engine = readyEngine();
      engine.application_configuration = Promise.resolve({
        ...appConfig(),
        ATTRIBUTION_POLICY: {
          schemaVersion: 1,
          repositoryId: 'repo-1',
          revision: 'v1',
          storage: 'remote',
          tier: 'free',
          content: { patch: true, lines: true },
        },
      });
      engine.sourceContext = root;
      engine.sourceCapture = captureSource(root, 'build-start');
      await engine.upload_assets({ assetsMap: {}, buildStats: {} as never });
      const options = uploadedOptions();
      const payload = JSON.parse(mocks.makeRequest.mock.calls[0][2]);
      expect(payload).toMatchObject({
        applicationUid: engine.application_uid,
        buildId: 'build-1',
        snapshotId: options.snapshot.snapshot_id,
      });
      expect(
        payload.comparison.changes.find(
          (change: { file: string }) => change.file === 'app.txt'
        ).lines[0].text
      ).toBe('remote source');
      expect(options.snapshot.changeAttribution?.remote?.recordId).toBe('record-1');
      expect(options.snapshot.changeAttribution).not.toHaveProperty('files');
      expect(options.getDashData(engine).changeAttribution).toEqual(
        options.snapshot.changeAttribution
      );
      expect(mocks.makeRequest.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.uploadStrategy.mock.invocationCallOrder[0]
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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
