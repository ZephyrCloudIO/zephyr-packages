import { ZephyrEngine } from 'zephyr-agent';
import path from 'node:path';
import type { RspressPlugin } from '@rspress/shared';
import { withZephyrRspressSSG } from './withZephyrRspressSSG';
import { walkFiles } from './internal/files/walkFiles';
import { showFiles } from './internal/files/showFiles';

export const zephyrRspressSSGPlugin = ({ outDir = 'doc_build' }): RspressPlugin => {
  const root = path.resolve(outDir);

  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  zephyr_defer_create({ builder: 'rspack', context: root });

  return {
    name: 'plugin-zephyr-rspress-ssg',
    async afterBuild() {
      const files = await walkFiles(root);

      if (files.length === 0) {
        console.warn('No files found in output directory.');
        return;
      }

      await showFiles(root, files);

      await withZephyrRspressSSG({ deferEngine: zephyr_engine_defer, root, files });
    },
  };
};
