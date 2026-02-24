import * as path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import {
  buildAssetsMap,
  handleGlobalError,
  zeBuildDashData,
  ZeErrors,
  ZephyrEngine,
  type ZephyrBuildHooks,
  ZephyrError,
  ze_log,
} from 'zephyr-agent';
import {
  collectAssetsFromBundle,
  detectEntrypointFromBundle,
  injectRscAssetsManifest,
  resolveVinextEntrypoint,
  type OutputBundleLike,
  type RscPluginManagerLike,
  type VinextBuildAsset,
} from './internal/vinext-output';

export interface VinextZephyrOptions {
  /** Build output directory (default: dist relative to Vite root). */
  outputDir?: string;
  /** Optional server entrypoint override, relative to outputDir. */
  entrypoint?: string;
  /** Optional Zephyr upload lifecycle hooks. */
  hooks?: ZephyrBuildHooks;
}

function resolveOutputDir(root: string, outputDir?: string): string {
  if (!outputDir) {
    return path.join(root, 'dist');
  }

  return path.isAbsolute(outputDir) ? outputDir : path.resolve(root, outputDir);
}

function getRscPluginManager(config: ResolvedConfig): RscPluginManagerLike | undefined {
  const plugin = config.plugins.find((item) => item?.name === 'rsc:minimal') as
    | { api?: { manager?: RscPluginManagerLike } }
    | undefined;

  return plugin?.api?.manager;
}

export function withZephyrVinext(options: VinextZephyrOptions = {}): Plugin {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

  const collectedAssets: Record<string, VinextBuildAsset> = {};

  let resolvedConfig: ResolvedConfig | undefined;
  let outputDir = '';
  let hasSsrEnvironment = false;
  let hasClientEnvironment = false;
  let detectedEntrypoint: string | undefined;
  let rscPluginManager: RscPluginManagerLike | undefined;
  let engineCreated = false;
  let uploadCompleted = false;
  let uploadPromise: Promise<void> | null = null;

  async function ensureEngine() {
    if (!engineCreated) {
      if (!resolvedConfig) {
        throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
          message: 'Vite config was not resolved before Zephyr upload.',
        });
      }

      zephyr_defer_create({
        builder: 'vite',
        context: resolvedConfig.root,
      });
      engineCreated = true;
    }

    return zephyr_engine_defer;
  }

  async function uploadVinextBuild(): Promise<void> {
    if (uploadCompleted) {
      return;
    }

    if (uploadPromise) {
      await uploadPromise;
      return;
    }

    uploadPromise = (async () => {
      const zephyrEngine = await ensureEngine();
      const assetCount = Object.keys(collectedAssets).length;

      if (assetCount === 0) {
        throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
          message:
            'No emitted Vinext assets were captured from Vite bundle hooks. ' +
            'Ensure withZephyr() is included in plugins during build.',
        });
      }

      const entrypoint = resolveVinextEntrypoint(
        outputDir,
        detectedEntrypoint,
        options.entrypoint
      );

      ze_log.upload(
        `Uploading Vinext build (${assetCount} assets, entrypoint: ${entrypoint})`
      );

      await zephyrEngine.start_new_build();
      await zephyrEngine.upload_assets({
        assetsMap: buildAssetsMap(
          collectedAssets,
          (asset) => asset.content,
          (asset) => asset.type
        ),
        buildStats: await zeBuildDashData(zephyrEngine),
        snapshotType: 'ssr',
        entrypoint,
        hooks: options.hooks,
      });
      await zephyrEngine.build_finished();

      uploadCompleted = true;
    })();

    try {
      await uploadPromise;
    } finally {
      uploadPromise = null;
    }
  }

  return {
    name: 'vite-plugin-vinext-zephyr',
    apply: 'build',
    enforce: 'post',

    configResolved(config) {
      resolvedConfig = config;
      outputDir = resolveOutputDir(config.root, options.outputDir);
      rscPluginManager = getRscPluginManager(config);

      const configuredEnvironments = Object.keys(
        ((config as unknown as { environments?: Record<string, unknown> }).environments ??
          {}) as Record<string, unknown>
      );
      hasSsrEnvironment = configuredEnvironments.includes('ssr');
      hasClientEnvironment = configuredEnvironments.includes('client');
    },

    writeBundle(outputOptions, bundle) {
      try {
        const bundleDir = outputOptions.dir
          ? path.resolve(resolvedConfig?.root ?? process.cwd(), outputOptions.dir)
          : outputDir;

        collectAssetsFromBundle(
          collectedAssets,
          outputDir,
          bundleDir,
          bundle as OutputBundleLike
        );
        detectedEntrypoint = detectEntrypointFromBundle(
          outputDir,
          bundleDir,
          bundle as OutputBundleLike,
          detectedEntrypoint
        );
      } catch (error) {
        handleGlobalError(error);
      }
    },

    async closeBundle(this: { environment?: { name?: string } }) {
      try {
        const environmentName = this.environment?.name;

        if (hasSsrEnvironment) {
          if (environmentName && environmentName !== 'ssr') {
            return;
          }
        } else if (hasClientEnvironment) {
          if (environmentName && environmentName !== 'client') {
            return;
          }
          if (!environmentName) {
            return;
          }
        } else if (environmentName && environmentName !== 'build') {
          return;
        }

        if (Object.keys(collectedAssets).length === 0) {
          return;
        }
        if (!options.entrypoint && !detectedEntrypoint) {
          return;
        }

        injectRscAssetsManifest(collectedAssets, outputDir, rscPluginManager);

        await uploadVinextBuild();
      } catch (error) {
        handleGlobalError(error);
      }
    },
  };
}
