import type { WebpackPluginInstance } from 'webpack';
import dotenv from 'dotenv';

export const generateRuntimeEnvPlugin = (): WebpackPluginInstance => ({
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('GenerateRuntimeEnvPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'GenerateRuntimeEnvPlugin',
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        () => {
          const rawEnv = dotenv.config().parsed || {};
          const safeEnv = Object.fromEntries(
            Object.entries(rawEnv).filter(([key]) => key.startsWith('ZE_'))
          );
          const content = `window.__ENV__ = ${JSON.stringify(safeEnv, null, 2)};`;
          compilation.emitAsset('runtime-env.js', new compiler.webpack.sources.RawSource(content));
        }
      );
    });
  },
});
