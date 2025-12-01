import { onDeploymentDone } from '../lifecycle-events/index';
import { xpack_zephyr_agent } from '../xpack-extract/ze-xpack-upload-agent';
import type { ZephyrEngine, ZephyrBuildHooks } from 'zephyr-agent';
import type { Source } from 'zephyr-edge-contract';
import type { XStats, ModuleFederationPlugin } from '../xpack.types';

interface DeployPluginOptions {
  pluginName: string;
  zephyr_engine: ZephyrEngine;
  wait_for_index_html?: boolean;
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  hooks?: ZephyrBuildHooks;
}

interface DeployCompiler {
  webpack: { Compilation: { PROCESS_ASSETS_STAGE_REPORT: number } };
  hooks: {
    thisCompilation: {
      tap: (pluginName: string, cb: (compilation: DeployCompilation) => void) => void;
    };
  };
}

interface DeployCompilation {
  getStats: () => XStats;
  hooks: {
    processAssets: {
      tapPromise: (
        options: { name: string; stage: number },
        cb: (assets: Record<string, Source>) => Promise<void>
      ) => void;
    };
  };
}

export function setupZeDeploy<
  T extends DeployPluginOptions,
  XCompiler extends DeployCompiler,
>(pluginOptions: T, compiler: XCompiler): void {
  const { pluginName } = pluginOptions;

  compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
    compilation.hooks.processAssets.tapPromise(
      {
        name: pluginName,
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
      },
      async (assets) => {
        const stats = compilation.getStats();
        const stats_json = compilation.getStats().toJson();

        await pluginOptions.zephyr_engine.start_new_build();

        process.nextTick(() => {
          void xpack_zephyr_agent({
            stats,
            stats_json,
            assets,
            pluginOptions,
          });
        });

        if (!pluginOptions.wait_for_index_html) {
          await onDeploymentDone();
        }

        // empty line to separate logs from other plugins
        console.log();
      }
    );
  });
}
