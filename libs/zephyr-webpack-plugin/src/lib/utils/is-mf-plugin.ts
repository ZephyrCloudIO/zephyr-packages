import { Configuration } from 'webpack';

type Plugin = NonNullable<Configuration['plugins']>[number];

export function isModuleFederationPlugin(plugin?: Plugin): boolean {
  if (!plugin || typeof plugin !== 'object') return false;
  return plugin.constructor.name.includes('ModuleFederationPlugin') || plugin['name']?.includes('ModuleFederationPlugin');
}
