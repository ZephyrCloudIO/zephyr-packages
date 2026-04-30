import { ZEPHYR_MANIFEST_FILENAME, type ZeBuildAssetsMap } from 'zephyr-edge-contract';
import { ZephyrEngine } from '../index';

describe('ZephyrEngine.upload_assets', () => {
  it('adds an empty zephyr manifest asset when no federated dependencies were resolved', async () => {
    const engine = Object.create(ZephyrEngine.prototype) as ZephyrEngine;
    engine.federated_dependencies = null;

    const assetsMap: ZeBuildAssetsMap = {};

    await engine.upload_assets({
      assetsMap,
      buildStats: {} as never,
    });

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
});
