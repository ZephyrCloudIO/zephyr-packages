import type { RspressPlugin } from '@rspress/shared';
import path from 'node:path';
import { ZephyrEngine, ZephyrError, logFn, ze_log } from 'zephyr-agent';
import { setupZeDeploy } from './internal/assets/setupZeDeploy';
import { showFiles } from './internal/files/showFiles';
import { walkFiles } from './internal/files/walkFiles';

export const zephyrRspressSSGPlugin = ({ outDir = 'doc_build' }): RspressPlugin => {
  const root = path.resolve(outDir);

  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  zephyr_defer_create({ builder: 'rspack', context: root });

  return {
    name: 'zephyr-rspress-plugin-ssg',
    async afterBuild() {
      try {
        const files = await walkFiles(root);

        if (files.length === 0) {
          ze_log.upload('No files found in output directory.');
          return;
        }

        await showFiles(root, files);

        await setupZeDeploy({ deferEngine: zephyr_engine_defer, root, files });
      } catch (error) {
        logFn('error', ZephyrError.format(error));
      }
    },
  };
};
