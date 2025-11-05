import {
  logFn,
  zeBuildDashData,
  ZephyrEngine,
  ZephyrError,
  zeBuildAssets,
} from 'zephyr-agent';
import type Site from 'lume/core/site.ts';
import { walk } from '@std/fs';
import { relative, join, extname, isAbsolute } from '@std/path';
import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';

/** Creates an assets map from the built Lume site */
async function getAssetsMap(outputDir: string): Promise<ZeBuildAssetsMap> {
  const assetsMap: ZeBuildAssetsMap = {};

  try {
    for await (const entry of walk(outputDir, {
      includeFiles: true,
      includeDirs: false,
    })) {
      if (entry.isFile) {
        // Get relative path from output directory
        const relativePath = relative(outputDir, entry.path);
        // Use forward slashes for consistency
        const normalizedPath = relativePath.replace(/\\/g, '/');

        // Read file content
        const content = await Deno.readFile(entry.path);

        // Create ZeBuildAsset object
        const asset = zeBuildAssets({
          filepath: normalizedPath,
          content: content,
        });

        // Map by hash
        assetsMap[asset.hash] = asset;
      }
    }
  } catch (error) {
    logFn('error', `Failed to collect assets: ${error}`);
  }

  return assetsMap;
}

/**
 * Zephyr plugin for Lume
 *
 * This plugin integrates Zephyr Cloud deployment with Lume static site generator. It
 * automatically uploads your built site to Zephyr Cloud after each build.
 *
 * @example
 *   ```ts
 *   import lume from 'lume/mod.ts';
 *   import { withZephyr } from 'lume-plugin-zephyr';
 *
 *   const site = lume();
 *
 *   site.use(withZephyr());
 *
 *   export default site;
 *   ```;
 *
 * @returns A Lume plugin function
 */
export function withZephyr() {
  return (site: Site) => {
    const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

    // Initialize Zephyr Engine when the plugin is loaded
    site.addEventListener('beforeBuild', () => {
      try {
        // Get the source directory (where _config.ts is located)
        const context = site.src();

        zephyr_defer_create({
          builder: 'lume',
          context,
        });
      } catch (error) {
        logFn('error', ZephyrError.format(error));
      }
    });

    // Upload assets after the build is complete
    site.addEventListener('afterBuild', async () => {
      try {
        const zephyr_engine = await zephyr_engine_defer;

        // Start a new build
        await zephyr_engine.start_new_build();

        // Get the full output path
        const destPath = site.dest();
        const fullOutputPath = isAbsolute(destPath)
          ? destPath
          : join(site.src(), destPath);

        // Collect and upload assets
        await zephyr_engine.upload_assets({
          assetsMap: await getAssetsMap(fullOutputPath),
          buildStats: await zeBuildDashData(zephyr_engine),
        });

        await zephyr_engine.build_finished();
      } catch (error) {
        logFn('error', ZephyrError.format(error));
      }
    });
  };
}
