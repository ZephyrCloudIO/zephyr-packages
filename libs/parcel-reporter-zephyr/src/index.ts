import { Reporter } from '@parcel/plugin';
import { zeBuildDashData, ZephyrEngine } from 'zephyr-agent';
import { getAssetsMap, ParcelOutputAsset } from './lib/get-assets-map';
import * as path from 'path';

// Create the engine and assets map outside the reporter function
// so they persist between calls
const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
const assets = new Map<string, ParcelOutputAsset>();

export default new Reporter({
  report: async ({ event, options }) => {
    const projectRoot = options.projectRoot;

    if (event.type === 'buildStart') {
      zephyr_defer_create({
        builder: 'parcel',
        context: projectRoot,
      });
    }

    if (event.type === 'buildSuccess') {
      const zephyr_engine = await zephyr_engine_defer;

      // Start a new build
      await zephyr_engine.start_new_build();

      // Collect assets from the build
      event.bundleGraph.getBundles().forEach((bundle) => {
        const filePath = bundle.filePath;
        if (!filePath) return;

        const name = path.basename(filePath);

        assets.set(name, {
          name: name,
          filePath,
          type: bundle.type,
        });
      });

      // Upload assets and finish the build
      await zephyr_engine.upload_assets({
        assetsMap: getAssetsMap(assets),
        buildStats: await zeBuildDashData(zephyr_engine),
      });

      await zephyr_engine.build_finished();
    }
  },
});
