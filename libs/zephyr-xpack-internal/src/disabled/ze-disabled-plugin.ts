import { logZephyrDisabled } from 'zephyr-agent';

/** The part of a webpack or rspack compiler that skip mode needs. */
interface DisabledCompilerLike {
  hooks: {
    done: {
      tap(name: string, callback: (stats: { hasErrors(): boolean }) => void): unknown;
    };
  };
}

interface DisabledConfigLike {
  plugins?: unknown[];
}

const pluginName = 'ZephyrDisabledPlugin';

/**
 * Skip mode for webpack and rspack (`ZE_DISABLED=true`). Every configuration gets one
 * tiny plugin and nothing else: no Zephyr engine, no token, no git information, no
 * network request. The bundle is built as it is without Zephyr. Once every compiler has
 * finished without errors, the plugins say once that the bundle was not deployed.
 */
export function disableZephyrForXpack<
  T extends DisabledConfigLike | DisabledConfigLike[],
>(config: T): T {
  const configs = Array.isArray(config) ? config : [config];
  let announced = false;
  let finished = 0;

  const plugin = {
    apply(compiler: DisabledCompilerLike): void {
      let counted = false;
      compiler.hooks.done.tap(pluginName, (stats) => {
        // A failed compile did not build the bundle. A watch rebuild can still succeed.
        if (stats.hasErrors()) return;
        if (!counted) {
          counted = true;
          finished += 1;
        }
        if (announced || finished < configs.length) return;
        announced = true;
        logZephyrDisabled();
      });
    },
  };

  for (const item of configs) {
    (item.plugins ??= []).push(plugin);
  }
  return config;
}
