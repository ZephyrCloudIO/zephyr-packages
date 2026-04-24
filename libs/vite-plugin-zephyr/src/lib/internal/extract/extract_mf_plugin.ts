import type { Plugin, PluginOption } from 'vite';
import type { ModuleFederationOptions } from '../mf-vite-etl/ensure_runtime_plugin.js';

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

export function extract_mf_plugin(plugins: readonly PluginOption[]) {
  return flattenPlugins(plugins).find(
    (plugin) => plugin.name === 'module-federation-vite'
  ) as (Plugin & ViteMFPlugin) | undefined;
}
