import { logZephyrDisabled } from 'zephyr-agent';

/** The part of a webpack or rspack compiler that skip mode needs. */
interface DisabledCompilerLike {
  hooks: {
    done: { tap(name: string, callback: () => void): unknown };
  };
}

interface DisabledConfigLike {
  plugins?: unknown[];
}

const pluginName = 'ZephyrDisabledPlugin';

/**
 * Skip mode for webpack and rspack (`ZE_DISABLED=true`). The configuration gets one tiny
 * plugin and nothing else: no Zephyr engine, no token, no git information, no network
 * request. The bundle is built as it is without Zephyr, then the plugin says once that it
 * was not deployed.
 */
export function disableZephyrForXpack<
  T extends DisabledConfigLike | DisabledConfigLike[],
>(config: T): T {
  let announced = false;
  const plugin = {
    apply(compiler: DisabledCompilerLike): void {
      compiler.hooks.done.tap(pluginName, () => {
        if (announced) return;
        announced = true;
        logZephyrDisabled();
      });
    },
  };

  for (const item of Array.isArray(config) ? config : [config]) {
    (item.plugins ??= []).push(plugin);
  }
  return config;
}
