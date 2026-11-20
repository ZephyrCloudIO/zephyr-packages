import { isModuleFederationPlugin } from './is-module-federation-plugin';
import { ze_log } from 'zephyr-agent';

interface PluginHolder {
  plugins?: unknown[];
}

export type PluginSnapshot = {
  plugins: readonly unknown[] | undefined;
  restoreFederation: (() => void)[];
}[];

/** Where the Module Federation plugins of webpack, Rspack and Nx keep their options. */
const FEDERATION_OPTION_KEYS = ['_options', 'options', 'config', 'configOverride'];

/** Writes only what changed, so a frozen value that was never mutated is left alone. */
function snapshotContents(value: unknown): () => void {
  if (Array.isArray(value)) {
    const items = [...value];
    return () => {
      const changed =
        value.length !== items.length ||
        value.some((item, index) => item !== items[index]);
      if (changed) value.splice(0, value.length, ...items);
    };
  }
  if (value && typeof value === 'object') {
    const fields = { ...value };
    return () => {
      for (const field of Object.keys(value)) {
        if (!Object.hasOwn(fields, field)) Reflect.deleteProperty(value, field);
      }
      for (const [field, original] of Object.entries(fields)) {
        if (Reflect.get(value, field) !== original) Reflect.set(value, field, original);
      }
    };
  }
  return () => undefined;
}

/** Restores both what `owner[key]` points to and the contents of that value. */
function snapshotField(owner: object, key: string): () => void {
  const hadOwn = Object.hasOwn(owner, key);
  const original: unknown = Reflect.get(owner, key);
  const restoreContents = snapshotContents(original);
  return () => {
    restoreContents();
    if (hadOwn) Reflect.set(owner, key, original);
    else Reflect.deleteProperty(owner, key);
  };
}

function snapshotFederationPlugin(plugin: object): (() => void)[] {
  const restores = [snapshotField(plugin, 'configOverride')];
  for (const key of FEDERATION_OPTION_KEYS) {
    const options: unknown = Reflect.get(plugin, key);
    if (!options || typeof options !== 'object') continue;
    const fields: unknown = 'config' in options ? options.config : options;
    if (!fields || typeof fields !== 'object') continue;
    restores.push(
      snapshotField(fields, 'remotes'),
      snapshotField(fields, 'runtimePlugins')
    );
  }
  return restores;
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
  return configs.map((config) => ({
    plugins: config.plugins ? [...config.plugins] : undefined,
    restoreFederation: (config.plugins ?? [])
      .filter(isModuleFederationPlugin)
      .flatMap((plugin) => snapshotFederationPlugin(plugin)),
  }));
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
