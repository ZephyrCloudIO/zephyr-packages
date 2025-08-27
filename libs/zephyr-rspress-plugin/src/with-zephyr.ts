import type { RspressPlugin } from '@rspress/shared';
import { zephyrRsbuildPlugin } from './zephyrRsbuildPlugin';
import { zephyrRspressSSGPlugin } from './zephyrRspressSSGPlugin';

export function withZephyr(): RspressPlugin {
  return {
    name: 'zephyr-rspress-plugin',
    async config(config, { addPlugin }) {
      const { ssg = false } = config;

      if (ssg) {
        addPlugin(zephyrRspressSSGPlugin(config));
      } else {
        config.builderPlugins = [...(config.builderPlugins ?? []), zephyrRsbuildPlugin()];
      }
      return config;
    },
  };
}
