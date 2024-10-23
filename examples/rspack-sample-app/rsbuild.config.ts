import { defineConfig, RsbuildPlugin } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { withZephyr } from 'zephyr-webpack-plugin';

const zephyrRSbuildPlugin = (): RsbuildPlugin => ({
  name: 'zephyr-rsbuild-plugin',
  setup(api) {
    api.modifyRspackConfig(async (config) => {
      //@ts-expect-error - zephyr-webpack-plugin types different than rspack types
      const zephyrConfig = await withZephyr()(config);
      //@ts-expect-error - zephyr-webpack-plugin types different than rspack types
      config = zephyrConfig;
    });
  },
});

export default defineConfig({
  plugins: [pluginReact(), zephyrRSbuildPlugin()],
});
