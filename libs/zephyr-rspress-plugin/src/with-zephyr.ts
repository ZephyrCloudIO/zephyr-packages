import type { RspressPlugin } from '@rspress/shared';
import { zephyrRspressSSGPlugin } from './zephyrRspressSSGPlugin';
import { zephyrRsbuildPlugin } from './zephyrRsbuildPlugin';

export function withZephyr(): RspressPlugin {
  return {
    name: 'plugin-zephyr-rspress',
    async config(config, { addPlugin }) {
      const { ssg = false } = config;

      if (ssg) {
        addPlugin(zephyrRspressSSGPlugin({ outDir: config.outDir }));
      } else {
        config.builderPlugins?.push(zephyrRsbuildPlugin());
      }
      return config;
    },
  };
}
