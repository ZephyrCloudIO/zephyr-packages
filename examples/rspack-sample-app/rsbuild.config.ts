import { defineConfig, RsbuildPlugin } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { withZephyr } from 'zephyr-rspack-plugin';

const zephyrRSbuildPlugin = (): RsbuildPlugin => ({
  name: 'zephyr-rsbuild-plugin',
  setup(api) {
    api.modifyRspackConfig(async (config) => {
      const zephyrConfig = await withZephyr()(config);
      config = zephyrConfig;
    });
  },
});

export default defineConfig({
  plugins: [pluginReact(), zephyrRSbuildPlugin()],
});
