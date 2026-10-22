import type { Plugin } from 'vite' with {
  'resolution-mode': 'import',
};
import { logZephyrDisabled } from 'zephyr-agent';

/**
 * Skip mode for Vite (`ZE_DISABLED=true`). Vite builds the bundle as it is without
 * Zephyr: no Zephyr engine, no token, no git information, no network request. Once a
 * build closes without an error, the plugin says that the bundle was not deployed.
 */
export function zephyrDisabledPlugin(): Plugin {
  let announced = false;
  let failed = false;
  return {
    name: 'with-zephyr-disabled',
    apply: 'build',
    enforce: 'post',
    buildStart() {
      failed = false;
    },
    renderStart() {
      failed = false;
    },
    buildEnd(error) {
      failed = Boolean(error);
    },
    // Vite closes the bundle even when rendering or writing it failed.
    renderError() {
      failed = true;
    },
    closeBundle() {
      if (announced || failed) return;
      announced = true;
      logZephyrDisabled();
    },
  };
}
