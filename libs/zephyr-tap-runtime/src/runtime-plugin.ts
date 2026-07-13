import type {
  ModuleFederation,
  ModuleFederationRuntimePlugin,
} from '@module-federation/runtime';
import { TapLifecycleCoordinator } from './tap-lifecycle';
import type { TapLifecycle, TapLifecyclePluginOptions } from './types';

const lifecycleAttachment = Symbol.for('zephyr-tap-runtime.lifecycle');

type HostWithTapLifecycle = ModuleFederation & {
  tapLifecycle?: TapLifecycle;
  [lifecycleAttachment]?: TapLifecycle;
};

export type TapLifecycleRuntimePlugin = ModuleFederationRuntimePlugin & {
  apply(instance: ModuleFederation): void;
};

/**
 * A runtime plugin intentionally limited to the trusted TAP host. Core may invoke `apply`
 * once per hook group, so the non-enumerable attachment symbol makes registration
 * idempotent for each Module Federation instance.
 */
export function createTapLifecycleRuntimePlugin(
  options: TapLifecyclePluginOptions
): TapLifecycleRuntimePlugin {
  return {
    name: 'zephyr-tap-runtime',
    apply(instance: ModuleFederation) {
      const host = instance as HostWithTapLifecycle;
      if (host[lifecycleAttachment]) {
        return;
      }
      if (host.tapLifecycle) {
        throw new Error(
          'A TAP lifecycle coordinator is already attached to this Module Federation instance.'
        );
      }

      const lifecycle = new TapLifecycleCoordinator(options);
      Object.defineProperty(host, lifecycleAttachment, {
        configurable: false,
        enumerable: false,
        value: lifecycle,
        writable: false,
      });
      Object.defineProperty(host, 'tapLifecycle', {
        configurable: false,
        enumerable: false,
        value: lifecycle,
        writable: false,
      });
    },
  };
}

export default createTapLifecycleRuntimePlugin;
