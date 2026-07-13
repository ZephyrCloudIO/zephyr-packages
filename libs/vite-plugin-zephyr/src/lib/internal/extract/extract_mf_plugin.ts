import type { Plugin, PluginOption } from 'vite' with {
  'resolution-mode': 'import',
};
import type { ModuleFederationOptions } from '../mf-vite-etl/ensure_runtime_plugin';

export interface ViteMFPlugin {
  _options: ModuleFederationOptions;
}

type FlatPluginOption = Plugin | false | null | undefined;

function isPlugin(plugin: FlatPluginOption): plugin is Plugin {
  return !!plugin && typeof plugin === 'object' && 'name' in plugin;
}

function flattenPlugins(plugins: readonly PluginOption[]): Plugin[] {
  const flatPlugins = (plugins as readonly unknown[]).flat(
    Infinity
  ) as FlatPluginOption[];
  return flatPlugins.filter(isPlugin);
}

export function extract_mf_plugins(
  plugins: readonly PluginOption[]
): Array<Plugin & ViteMFPlugin> {
  return flattenPlugins(plugins).filter(
    (plugin): plugin is Plugin & ViteMFPlugin =>
      plugin.name === 'module-federation-vite' &&
      '_options' in plugin &&
      !!(plugin as Partial<ViteMFPlugin>)._options
  );
}

export function extract_mf_plugin(plugins: readonly PluginOption[]) {
  return extract_mf_plugins(plugins)[0];
}
