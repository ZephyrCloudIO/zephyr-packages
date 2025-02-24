import { onDeploymentDone } from '../lifecycle-events/index';
import { xpack_zephyr_agent } from '../xpack-extract/ze-xpack-upload-agent';
import { ZephyrEngine } from 'zephyr-agent';
import type { Source } from 'zephyr-edge-contract';
import { XStats } from '../xpack.types';

interface DeployPluginOptions {
  pluginName: string;
  zephyr_engine: ZephyrEngine;
  wait_for_index_html?: boolean;
}

interface DeployCompiler {
  webpack: {
    sources: { RawSource: new (content: string) => Source };
    Compilation: { PROCESS_ASSETS_STAGE_REPORT: number };
  };
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
  compiler.hooks.thisCompilation;
  compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
    compilation.hooks.processAssets.tapPromise(
      {
        name: pluginName,
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
      },
      async (assets) => {
        // Inject build ID into HTML files if in CI test mode
        try {
          if (process.env['ZE_CI_TEST']) {
            const htmlFiles = Object.keys(assets).filter((file) =>
              file.endsWith('.html')
            );

            for (const htmlFile of htmlFiles) {
              const content = assets[htmlFile].source().toString();
              const modifiedContent =
                await pluginOptions.zephyr_engine.injectBuildIdMeta(content);

              assets[htmlFile] = new compiler.webpack.sources.RawSource(modifiedContent);
            }
          }
        } catch (error) {
          console.error('Failed to inject build ID into HTML files:', error);
          throw error;
        }

        const stats = compilation.getStats();
        const stats_json = compilation.getStats().toJson();

        await pluginOptions.zephyr_engine.start_new_build();

        process.nextTick(xpack_zephyr_agent, {
          stats,
          stats_json,
          assets,
          pluginOptions,
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
