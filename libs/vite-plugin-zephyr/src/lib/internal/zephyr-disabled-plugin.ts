import type { Plugin } from 'vite' with {
  'resolution-mode': 'import',
};
import { createZephyrDisabledBuildHooks } from 'zephyr-agent';

/**
 * Skip mode for Vite (`ZE_DISABLED=true`). Vite builds the bundle as it is without
 * Zephyr: no Zephyr engine, no token, no git information, no network request. Once a
 * build closes without an error, the plugin says that the bundle was not deployed.
 */
export function zephyrDisabledPlugin(): Plugin {
  return {
    name: 'with-zephyr-disabled',
    apply: 'build',
    enforce: 'post',
    ...createZephyrDisabledBuildHooks(),
  };
}
