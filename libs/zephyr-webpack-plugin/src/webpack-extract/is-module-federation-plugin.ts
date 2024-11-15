import {
  ModuleFederationPlugin,
  WebpackConfiguration,
} from '../types/missing-webpack-types';

/** @private */
type __webpack_plugin__ = NonNullable<WebpackConfiguration['plugins']>[number];

export function isModuleFederationPlugin(
  plugin?: __webpack_plugin__
): plugin is ModuleFederationPlugin {
  if (!plugin || typeof plugin !== 'object') return false;

  if (
    typeof plugin.constructor.name?.includes === 'function' &&
    plugin.constructor.name?.includes('ModuleFederationPlugin')
  ) {
    return true;
  }

  return Boolean(
    plugin['name']?.includes && plugin['name']?.includes('ModuleFederationPlugin')
  );
}
