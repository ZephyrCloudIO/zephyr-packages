import type { RsbuildPlugin } from '@rsbuild/core';
import {
  assertZephyrBuildTarget,
  ZephyrEngine,
  type ZephyrBuildTarget,
} from 'zephyr-agent';
import {
  withZephyr as rspackWithZephyr,
  type ZephyrBuildHooks,
} from 'zephyr-rspack-plugin';
import { coordinateXPackCompilers } from 'zephyr-xpack-internal';

export interface ZephyrRsbuildPluginOptions {
  /** Zephyr build target, including the `tap-app` mini-app artifact family. */
  target?: ZephyrBuildTarget;
  wait_for_index_html?: boolean;
  hooks?: ZephyrBuildHooks;
  snapshotType?: 'csr' | 'ssr';
  entrypoint?: string;
}

type RspackWithZephyrConfig = Parameters<ReturnType<typeof rspackWithZephyr>>[0];

export function withZephyr(options?: ZephyrRsbuildPluginOptions): RsbuildPlugin {
  const target = options?.target;
  if (target !== undefined) {
    assertZephyrBuildTarget(target, 'withZephyr({ target })');
  }
  return {
    name: 'zephyr-rsbuild-plugin',
    setup(api) {
      // Per Rspack team: @module-federation/rsbuild-plugin adds MF plugins in onBeforeCreateCompiler,
      // which runs AFTER modifyRspackConfig. So we must process the configs in onBeforeCreateCompiler
      // where the MF plugins are already present.
      // Using order: 'post' ensures we run after the MF plugin has set up the config.
      api.onBeforeCreateCompiler({
        order: 'post',
        handler: async ({ bundlerConfigs }) => {
          if (bundlerConfigs.length === 0) {
            return;
          }
          const engine = await ZephyrEngine.create({
            builder: 'rspack',
            context: bundlerConfigs[0]?.context,
            target,
          });
          if (target !== undefined) {
            engine.env.target = target;
          }
          try {
            const { coordinator, compilers } = coordinateXPackCompilers(
              engine,
              bundlerConfigs,
              {
                snapshotType: options?.snapshotType,
                entrypoint: options?.entrypoint,
              }
            );

            // Process each bundler config (one per environment)
            for (const [index, config] of bundlerConfigs.entries()) {
              // Rsbuild and the rspack plugin can resolve compatible patch versions
              // of @rspack/core independently, which makes their config types nominally
              // incompatible in TS even though the runtime config shape is the same.
              const rspackConfig = config as RspackWithZephyrConfig;

              // Apply Zephyr's rspack transformation
              // The real MF plugin is already present in the config and rspackWithZephyr will extract from it
              const result = await rspackWithZephyr({
                ...options,
                target,
                __engine: engine,
                __coordinator: coordinator,
                __participant: compilers[index]?.participant,
                __assetPrefix: compilers[index]?.assetPrefix,
              })(rspackConfig);

              // Merge result back (rspackWithZephyr may return a new config or void)
              if (result) {
                Object.assign(config, result);
              }
            }
          } catch (error: unknown) {
            if (engine.hasActiveBuild) engine.build_failed();
            throw error;
          }
        },
      });
    },
  };
}
