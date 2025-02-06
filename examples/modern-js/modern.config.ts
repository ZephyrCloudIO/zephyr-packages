import {
  type AppTools,
  type CliPluginFuture,
  appTools,
  defineConfig,
} from '@modern-js/app-tools';
import { withZephyr } from 'zephyr-modernjs-plugin';

export const dummy = (): CliPluginFuture<AppTools<'rspack' | 'webpack'>> => ({
  name: 'test-plugin',
  // pre: ['@modern-js/plugin-module-federation-config'],

  setup: async api => {
    api.config(() => {
      return {
        tools: {
          rspack(config) {
            console.log('rspack config', config.plugins);
          },
        },
      };
    });
  },
});

export default defineConfig({
  output: {
    distPath: {
      html: './',
    },
  },
  html: {
    outputStructure: 'flat',
  },
  source: {
    mainEntryName: 'index',
  },
  runtime: {
    router: true,
  },
  plugins: [
    appTools({
      bundler: 'rspack', // Set to 'webpack' to enable webpack
    }),
    withZephyr(),
    // dummy(),
  ],
  // builderPlugins: [withZephyr()],
});
