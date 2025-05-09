import { ZephyrEngine } from 'zephyr-agent';
import path from 'node:path';
import type { RspressPlugin } from '@rspress/shared';
import { setupZeDeploy } from './internal/assets/setupZeDeploy';
import { walkFiles } from './internal/files/walkFiles';
import { showFiles } from './internal/files/showFiles';
import { ze_log } from 'zephyr-agent';

export const zephyrRspressSSGPlugin = ({ outDir = 'doc_build' }): RspressPlugin => {
  const root = path.resolve(outDir);

  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  zephyr_defer_create({ builder: 'rspack', context: root });

  return {
    name: 'zephyr-rspress-plugin-ssg',
    async afterBuild() {
      const files = await walkFiles(root);

      if (files.length === 0) {
        ze_log('No files found in output directory.');
        return;
      }

      await showFiles(root, files);

      await setupZeDeploy({ deferEngine: zephyr_engine_defer, root, files });
    },
  };
};
