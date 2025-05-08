import { RsbuildPlugin } from '@rsbuild/core';
import { withZephyr as withZephyrRspack } from 'zephyr-rspack-plugin';

export const zephyrRsbuildPlugin = (): RsbuildPlugin => ({
  name: 'zephyr-rspress-plugin',
  setup(api) {
    api.modifyRspackConfig(async (config) => {
      await withZephyrRspack()(config);
    });
  },
});
