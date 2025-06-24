import { onDeploymentDone } from '../lifecycle-events/index';
import { xpack_zephyr_agent } from '../xpack-extract/ze-xpack-upload-agent';
import type { ZephyrEngine } from 'zephyr-agent';
import type { Source } from 'zephyr-edge-contract';
import type { XStats } from '../xpack.types';

interface DeployPluginOptions {
  pluginName: string;
  zephyr_engine: ZephyrEngine;
  wait_for_index_html?: boolean;
  mfConfig: any; // Add mfConfig to match UploadAgentPluginOptions
}

interface DeployCompiler {
  webpack: { 
    Compilation: { 
      PROCESS_ASSETS_STAGE_REPORT: number;
      PROCESS_ASSETS_STAGE_ADDITIONS: number;
    } 
  };
  hooks: {
    thisCompilation: {
      tap: (pluginName: string, cb: (compilation: DeployCompilation) => void) => void;
    };
    make: {
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

  // Use the same hook pattern as Next.js core plugins (BuildManifestPlugin, etc.)
  compiler.hooks.make.tap(pluginName, (compilation) => {
    compilation.hooks.processAssets.tapPromise(
      {
        name: pluginName,
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
      },
      async (assets) => {
        const stats = compilation.getStats();
        const stats_json = compilation.getStats().toJson();

        await pluginOptions.zephyr_engine.start_new_build();

        // Start the upload process
        const uploadPromise = xpack_zephyr_agent({
          stats,
          stats_json,
          assets,
          pluginOptions,
        });

        if (!pluginOptions.wait_for_index_html) {
          // Wait for the upload to complete
          await uploadPromise;
        } else {
          // Don't wait for upload, but still run it in the background
          uploadPromise.catch((err) => {
            console.error('Zephyr upload failed:', err);
          });
        }

        // empty line to separate logs from other plugins
        console.log();
      }
    );
  });
}
