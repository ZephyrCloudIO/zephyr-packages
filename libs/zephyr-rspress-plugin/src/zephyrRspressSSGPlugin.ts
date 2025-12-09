import { resolve } from 'node:path';
import {
  ZephyrEngine,
  ZephyrError,
  logFn,
  ze_log,
  type ZephyrBuildHooks,
} from 'zephyr-agent';
import { setupZeDeploy } from './internal/assets/setupZeDeploy';
import { showFiles } from './internal/files/showFiles';
import { walkFiles } from './internal/files/walkFiles';

interface RspressUserConfig {
  root?: string;
  outDir?: string;
  [key: string]: unknown;
}

interface RspressPlugin {
  name: string;
  afterBuild?: () => void | Promise<void>;
}

export const zephyrRspressSSGPlugin = (
  config: RspressUserConfig,
  options?: { hooks?: ZephyrBuildHooks }
): RspressPlugin => {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  const root = resolve(config.root ?? '');
  const outDir = resolve(config.outDir ?? './doc_build');

  zephyr_defer_create({ builder: 'rspack', context: root });

  return {
    name: 'zephyr-rspress-plugin-ssg',
    async afterBuild() {
      try {
        const files = await walkFiles(outDir);

        if (files.length === 0) {
          ze_log.upload('No files found in output directory.');
          return;
        }

        await showFiles(outDir, files);

        await setupZeDeploy({
          deferEngine: zephyr_engine_defer,
          outDir,
          files,
          hooks: options?.hooks,
        });
      } catch (error) {
        logFn('error', ZephyrError.format(error));
      }
    },
  };
};
