import { Configuration } from 'webpack';

type Plugin = NonNullable<Configuration['plugins']>[number];

export function isModuleFederationPlugin(plugin?: Plugin): boolean {
  if (!plugin || typeof plugin !== 'object') return false;
  return (
    plugin.constructor.name.indexOf('ModuleFederationPlugin') !== -1 ||
    plugin['name']?.indexOf('ModuleFederationPlugin') !== -1
  );
}
