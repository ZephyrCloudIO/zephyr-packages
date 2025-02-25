import { ModuleFederationPlugin, XPackConfiguration } from '../xpack.types';

/** @private */
type __webpack_plugin__<T> = NonNullable<XPackConfiguration<T>['plugins']>[number];

/** Type guard that checks if a plugin is a ModuleFederationPlugin */
export function isModuleFederationPlugin<T>(
  plugin?: __webpack_plugin__<T>
): plugin is ModuleFederationPlugin {
  if (!plugin || typeof plugin !== 'object') return false;

  // Check constructor name if available
  if (
    'constructor' in plugin &&
    plugin.constructor &&
    typeof plugin.constructor.name === 'string' &&
    plugin.constructor.name.includes('ModuleFederationPlugin')
  ) {
    return true;
  }

  // Check plugin name property if available
  if ('name' in plugin) {
    const pluginName = plugin['name'];
    if (typeof pluginName === 'string' && pluginName.includes('ModuleFederationPlugin')) {
      return true;
    }
  }

  // Check for apply method (all webpack plugins have this)
  if ('apply' in plugin && typeof plugin.apply === 'function') {
    // Check for module federation specific properties
    if ('_options' in plugin || 'config' in plugin) {
      return true;
    }
  }

  return false;
}
