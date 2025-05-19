import type { RsbuildPlugin } from '@rsbuild/core';
import { withZephyr } from 'zephyr-rspack-plugin';

export const zephyrRsbuildPlugin = (): RsbuildPlugin => ({
  name: 'zephyr-rsbuild-plugin',
  setup(api) {
    api.modifyRspackConfig(async (config) => {
      await withZephyr()(config);
    });
  },
});
