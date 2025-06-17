import type { Plugin } from 'vite';
import type { XFederatedConfig } from 'zephyr-rollx-internal';

export interface ViteMFPlugin {
  _options: XFederatedConfig;
}

export function extract_mf_plugin(plugins: readonly Plugin[]) {
  const mfPlugin = plugins.find((plugin) => plugin.name === 'module-federation-vite') as
    | (Plugin & ViteMFPlugin)
    | undefined;
  return mfPlugin;
}
