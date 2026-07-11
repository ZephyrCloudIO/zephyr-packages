import { describe, expect, it } from '@rstest/core';

import { ZEPHYR_MANIFEST_FILENAME, type ZeBuildAssetsMap } from 'zephyr-edge-contract';
import { ZephyrEngine } from '../index';

describe('ZephyrEngine.upload_assets', () => {
  it('adds an empty zephyr manifest asset when no federated dependencies were resolved', async () => {
    const engine = Object.create(ZephyrEngine.prototype) as ZephyrEngine;
    engine.federated_dependencies = null;

    const assetsMap: ZeBuildAssetsMap = {};

    await expect(
      engine.upload_assets({
        assetsMap,
        buildStats: {} as never,
      })
    ).rejects.toThrow(
      'ZephyrEngine cannot upload before application_uid and build_id are initialized.'
    );

    const manifestAsset = Object.values(assetsMap).find(
      (asset) => asset.path === ZEPHYR_MANIFEST_FILENAME
    );

    expect(manifestAsset).toBeDefined();
    expect(JSON.parse(manifestAsset?.buffer.toString('utf8') ?? '')).toMatchObject({
      version: '1.0.0',
      dependencies: {},
      zeVars: {},
    });
  });

  it('preserves the emitted manifest bytes instead of adding a conflicting path', async () => {
    const engine = Object.create(ZephyrEngine.prototype) as ZephyrEngine;
    engine.federated_dependencies = null;

    const emittedManifest = {
      path: ZEPHYR_MANIFEST_FILENAME,
      extname: '.json',
      hash: 'emitted-manifest-hash',
      size: 24,
      buffer: Buffer.from('{"source":"compilation"}'),
    };
    const assetsMap: ZeBuildAssetsMap = {
      [emittedManifest.hash]: emittedManifest,
    };

    await expect(
      engine.upload_assets({
        assetsMap,
        buildStats: {} as never,
      })
    ).rejects.toThrow(
      'ZephyrEngine cannot upload before application_uid and build_id are initialized.'
    );

    expect(
      Object.values(assetsMap).filter((asset) => asset.path === ZEPHYR_MANIFEST_FILENAME)
    ).toEqual([emittedManifest]);
  });
});
