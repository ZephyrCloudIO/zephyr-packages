// rspress.config.ts
import path from 'node:path';
import { defineConfig } from '@rspress/core';
import { withZephyr } from 'zephyr-rspress-plugin';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  outDir: './doc_build',
  ssg: true,
  plugins: [withZephyr()],
});
