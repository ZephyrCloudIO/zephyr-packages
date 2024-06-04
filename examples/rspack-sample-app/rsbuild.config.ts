import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { withZephyr } from 'zephyr-webpack-plugin';

const config =  defineConfig({
  plugins: [pluginReact()],
});

const res =  await withZephyr()(config as any);

export default res;
