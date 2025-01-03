import { UserConfig, PluginOption } from 'vite';

import { ModuleFederationOptions } from '../../vite-plugin-zephyr';

interface MFPlugin {
  name: string;
  _options?: ModuleFederationOptions;
}

export function is_mf_plugin(plugin: PluginOption): boolean {
  if (!plugin) return false;

  if (typeof plugin !== 'object') return false;

  return (
    'name' in plugin &&
    (plugin.name === 'module-federation-vite' ||
      plugin.name.includes('module-federation-vite'))
  );
}

export function get_mf_config(
  plugins: UserConfig['plugins']
): ModuleFederationOptions | undefined {
  if (!plugins) return;

  const mfPlugin = plugins.filter((p) => is_mf_plugin(p))[0] as unknown as MFPlugin;

  return mfPlugin?._options;
}
