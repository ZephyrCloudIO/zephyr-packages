import { Reporter } from '@parcel/plugin';
import { ZephyrEngine } from 'zephyr-agent';
import { onBuildStart } from './lib/on-build-start';
import { onBuildSuccess } from './lib/on-build-success';

// Create the engine and assets map outside the reporter function
// so they persist between calls
const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

export default new Reporter({
  report: async ({ event, options }) => {
    const projectRoot = options.inputFS.cwd();

    switch (event.type) {
      case 'buildStart':
        await onBuildStart({ zephyr_defer_create, projectRoot });
        break;
      case 'buildSuccess':
        await onBuildSuccess({ zephyr_engine_defer, event });
        break;
      default:
        // ignore unknown build hooks
        break;
    }
  },
});
