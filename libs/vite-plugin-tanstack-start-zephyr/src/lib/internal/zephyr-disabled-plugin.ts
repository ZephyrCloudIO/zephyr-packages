import type { Plugin } from 'vite' with {
  'resolution-mode': 'import',
};
import { logZephyrDisabled } from 'zephyr-agent';

/**
 * Skip mode for TanStack Start (`ZE_DISABLED=true`). The framework builds as it is
 * without Zephyr: no Zephyr engine, no token, no git information, no network request.
 * After every build environment has finished without an error, the plugin says that the
 * bundle was not deployed.
 */
export function zephyrDisabledPlugin(name: string): Plugin {
  return {
    name,
    enforce: 'post',
    buildApp: {
      order: 'post',
      async handler(builder) {
        // A failed environment throws before this hook runs, so reaching it means built.
        const notBuilt = Object.values(builder.environments).some(
          (environment) => !environment.isBuilt
        );
        if (!notBuilt) logZephyrDisabled();
      },
    },
  };
}
