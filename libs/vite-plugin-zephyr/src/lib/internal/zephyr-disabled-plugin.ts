import type { Plugin } from 'vite' with {
  'resolution-mode': 'import',
};
import { logZephyrDisabled } from 'zephyr-agent';

/**
 * Skip mode for Vite (`ZE_DISABLED=true`). Vite builds the bundle as it is without
 * Zephyr: no Zephyr engine, no token, no git information, no network request. Once the
 * build closes, the plugin says that the bundle was not deployed.
 */
export function zephyrDisabledPlugin(): Plugin {
  let announced = false;
  return {
    name: 'with-zephyr-disabled',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      if (announced) return;
      announced = true;
      logZephyrDisabled();
    },
  };
}
