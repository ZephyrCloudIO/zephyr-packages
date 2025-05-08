import path from 'node:path';
import type { RspressPlugin } from '@rspress/shared';
import { walkFiles, showFiles } from './utils';
import { ZeRspressPlugin } from './ze-rspress-plugin';

export function withZephyr(): RspressPlugin {
  return {
    name: 'plugin-rspress-ssg',

    async afterBuild({ outDir = 'doc_build' }) {
      const root = path.resolve(outDir);
      const files = await walkFiles(root);

      if (files.length === 0) {
        console.warn('No files found in output directory.');
        return;
      }

      await showFiles(root, files);

      await ZeRspressPlugin({ root, files });
    },
  };
}
