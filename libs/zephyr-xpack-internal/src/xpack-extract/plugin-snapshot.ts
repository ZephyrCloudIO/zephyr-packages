interface PluginHolder {
  plugins?: unknown[];
}

export type PluginSnapshot = (readonly unknown[] | undefined)[];

/** Remember each config's plugin list before Zephyr adds its plugins to it. */
export function snapshotPlugins(configs: readonly PluginHolder[]): PluginSnapshot {
  return configs.map((config) => (config.plugins ? [...config.plugins] : undefined));
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
    const original = snapshot[index];
    if (original === undefined) {
      delete config.plugins;
    } else if (config.plugins) {
      config.plugins.splice(0, config.plugins.length, ...original);
    } else {
      config.plugins = [...original];
    }
  }
}
