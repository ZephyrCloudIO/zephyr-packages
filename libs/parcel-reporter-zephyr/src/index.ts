import { Reporter } from '@parcel/plugin';
import { catchAsync, ZephyrEngine, type ZephyrBuildHooks } from 'zephyr-agent';
import { onBuildStart } from './lib/on-build-start';
import { onBuildSuccess } from './lib/on-build-success';

export interface ZephyrParcelReporterOptions {
  hooks?: ZephyrBuildHooks;
}

function createZephyrReporter(options?: ZephyrParcelReporterOptions) {
  // Create the engine and assets map outside the reporter function
  // so they persist between calls
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

  return new Reporter({
    report: async ({ event, options: parcelOptions }) => {
      await catchAsync(async () => {
        const projectRoot = parcelOptions.inputFS.cwd();

        switch (event.type) {
          case 'buildStart':
            await onBuildStart({ zephyr_defer_create, projectRoot });
            break;
          case 'buildSuccess':
            await onBuildSuccess({ zephyr_engine_defer, event, hooks: options?.hooks });
            break;
          default:
            // ignore unknown build hooks
            break;
        }
      });
    },
  });
}

export { createZephyrReporter };
export type { ZephyrBuildHooks, DeploymentInfo } from 'zephyr-agent';
export default createZephyrReporter();
