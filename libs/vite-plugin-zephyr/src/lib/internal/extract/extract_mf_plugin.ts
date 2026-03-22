import type { Plugin } from 'vite';
import type { ModuleFederationOptions } from '../../types/module-federation-options';

export interface ViteMFPlugin {
  _options: ModuleFederationOptions;
}

function flattenPlugins(plugins: readonly unknown[]): Plugin[] {
  const flat: Plugin[] = [];

  for (const plugin of plugins) {
    if (Array.isArray(plugin)) {
      flat.push(...flattenPlugins(plugin));
      continue;
    }

    if (plugin && typeof plugin === 'object' && 'name' in plugin) {
      flat.push(plugin as Plugin);
    }
  }

  return flat;
}

export function extract_mf_plugin(plugins: readonly unknown[]) {
  return flattenPlugins(plugins).find(
    (plugin) => plugin.name === 'module-federation-vite'
  ) as (Plugin & ViteMFPlugin) | undefined;
}
