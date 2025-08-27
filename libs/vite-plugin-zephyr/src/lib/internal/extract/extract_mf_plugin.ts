import type { Plugin } from 'vite';
import type { ModuleFederationOptions } from '../../vite-plugin-zephyr';

export interface ViteMFPlugin {
  _options: ModuleFederationOptions;
}

export function extract_mf_plugin(plugins: readonly Plugin[]) {
  const mfPlugin = plugins.find((plugin) => plugin.name === 'module-federation-vite') as
    | (Plugin & ViteMFPlugin)
    | undefined;
  return mfPlugin;
}
