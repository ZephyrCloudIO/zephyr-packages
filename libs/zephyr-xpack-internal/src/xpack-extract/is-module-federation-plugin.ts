import type { ModuleFederationPlugin } from '../xpack.types';

export function isModuleFederationPlugin(
  plugin: unknown
): plugin is ModuleFederationPlugin {
  if (!plugin || typeof plugin !== 'object') return false;

  const constructorName: unknown = plugin.constructor?.name;
  if (
    typeof constructorName === 'string' &&
    constructorName.includes('ModuleFederationPlugin')
  ) {
    return true;
  }

  const name: unknown = Reflect.get(plugin, 'name');
  return typeof name === 'string' && name.includes('ModuleFederationPlugin');
}
