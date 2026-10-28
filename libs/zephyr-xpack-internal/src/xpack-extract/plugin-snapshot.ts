import { isModuleFederationPlugin } from './is-module-federation-plugin';
import type { ModuleFederationPlugin } from '../xpack.types';
import { ze_log } from 'zephyr-agent';

interface PluginHolder {
  plugins?: unknown[];
}

export type PluginSnapshot = {
  plugins: readonly unknown[] | undefined;
  restoreFederation: (() => void)[];
}[];

function snapshotField(owner: object, key: string): () => void {
  const hadOwn = Object.hasOwn(owner, key);
  const original = Reflect.get(owner, key);
  const contents = Array.isArray(original)
    ? [...original]
    : original && typeof original === 'object'
      ? { ...original }
      : undefined;
  return () => {
    if (Array.isArray(original) && Array.isArray(contents)) {
      if (
        original.length !== contents.length ||
        original.some((value, index) => value !== contents[index])
      )
        original.splice(0, original.length, ...contents);
    } else if (original && typeof original === 'object' && contents) {
      for (const field of Object.keys(original)) {
        if (!Object.hasOwn(contents, field)) Reflect.deleteProperty(original, field);
      }
      for (const [field, value] of Object.entries(contents)) {
        if (Reflect.get(original, field) !== value) Reflect.set(original, field, value);
      }
    }
    if (hadOwn) Reflect.set(owner, key, original);
    else Reflect.deleteProperty(owner, key);
  };
}

function restoreSafely(restore: () => void): void {
  try {
    restore();
  } catch (error: unknown) {
    ze_log.mf('Failed to restore Zephyr plugin configuration:', error);
  }
}

/** Remember plugin lists and the federation fields changed during Zephyr setup. */
export function snapshotPlugins(configs: readonly PluginHolder[]): PluginSnapshot {
  return configs.map((config) => {
    const restoreFederation: (() => void)[] = [];
    for (const plugin of config.plugins ?? []) {
      const federationPlugin = plugin as ModuleFederationPlugin | undefined;
      if (!isModuleFederationPlugin(federationPlugin)) continue;
      restoreFederation.push(snapshotField(federationPlugin, 'configOverride'));
      const containers = ['_options', 'options', 'config', 'configOverride'];
      for (const key of containers) {
        const options = Reflect.get(federationPlugin, key);
        if (!options || typeof options !== 'object') continue;
        const fields = 'config' in options ? options.config : options;
        if (!fields || typeof fields !== 'object') continue;
        restoreFederation.push(
          snapshotField(fields, 'remotes'),
          snapshotField(fields, 'runtimePlugins')
        );
      }
    }
    return {
      plugins: config.plugins ? [...config.plugins] : undefined,
      restoreFederation,
    };
  });
}

/**
 * Put every plugin list back the way {@linkcode snapshotPlugins} found it.
 *
 * When Zephyr fails to configure a compiler array and the build continues, no compiler
 * may keep a Zephyr plugin: a coordinated build only publishes after every compiler
 * contributes, so a partial set would wait for a compiler that never reports.
 */
export function restorePlugins(
  configs: readonly PluginHolder[],
  snapshot: PluginSnapshot
): void {
  for (const [index, config] of configs.entries()) {
    const entry = snapshot[index];
    for (const restore of entry?.restoreFederation ?? []) restoreSafely(restore);
    const original = entry?.plugins;
    restoreSafely(() => {
      if (original === undefined) {
        delete config.plugins;
      } else if (config.plugins) {
        config.plugins.splice(0, config.plugins.length, ...original);
      } else {
        config.plugins = [...original];
      }
    });
  }
}
