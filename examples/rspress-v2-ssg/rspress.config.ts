import { defineConfig } from '@rspress/core';
import { transformerCompatibleMetaHighlight } from '@rspress/core/shiki-transformers';
import * as path from 'node:path';
import { withZephyr } from 'zephyr-rspress-plugin';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  outDir: './doc_build',
  ssg: true,
  markdown: {
    shiki: {
      transformers: [transformerCompatibleMetaHighlight()],
    },
  },
  plugins: [withZephyr()],
});
