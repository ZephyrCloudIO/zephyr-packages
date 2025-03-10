import { defineConfig, rspack } from '@lynx-js/rspeedy';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { withZephyr } from 'zephyr-rspack-plugin';

export default defineConfig({
  plugins: [
    pluginQRCode({
      schema(url) {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`;
      },
    }),
    pluginReactLynx(),
  ],
  tools: {
    async rspack(config, { appendPlugins }) {
      config = await withZephyr()(config);
      return config;
    },
  },
});
