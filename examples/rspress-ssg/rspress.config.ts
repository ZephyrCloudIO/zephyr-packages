import type { RsbuildPlugin } from '@rsbuild/core';
import type {  StatsCompilation } from '@rspack/core';
import * as path from 'node:path';
import { defineConfig } from 'rspress/config';
import { withZephyr } from 'zephyr-rspack-plugin';

const zephyrRsbuildPlugin = (): RsbuildPlugin => ({
  name: 'zephyr-rsbuild-plugin',
  setup(api) {
    // api.modifyRspackConfig(async (config: any) => {
    //   // this is important to avoid multiple zephyr build triggers
    //   config.name === 'web' && (await withZephyr()(config));
    // });
    api.onAfterBuild(async ({ stats }) => {
      if (!stats) return;
      const compilation: StatsCompilation | undefined = stats.toJson({ all: false, assets: true }).children?.[0] || stats.toJson({ all: false, assets: true });

      if (!compilation?.assets) {
        console.warn('No assets found in compilation stats.');
        return;
      }

      const outputFiles = compilation.assets.map((asset) => asset.name);

      console.log('Emitted output files:');
      for (const file of outputFiles) {
        console.log(file);
      }
    })
  },
});

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  title: 'My Site',
  icon: '/rspress-icon.png',
  logo: {
    light: '/rspress-light-logo.png',
    dark: '/rspress-dark-logo.png',
  },
  themeConfig: {
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/web-infra-dev/rspress',
      },
    ],
  },
  ssg: true,
  builderConfig: {
    plugins: [zephyrRsbuildPlugin()],
  },
});
