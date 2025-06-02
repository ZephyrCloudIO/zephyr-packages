import type { ModuleFederationPlugin, XFederatedRemotesConfig } from '../xpack.types';

export function extractFederatedConfig(
  plugin: ModuleFederationPlugin
): XFederatedRemotesConfig | undefined {
  if (!plugin) return undefined;
  if (plugin._options) {
    // NxModuleFederationPlugin support
    if ('config' in plugin._options) {
      plugin._options.config.filename ??= 'remoteEntry.js';
      return plugin._options.config;
    }
    // Webpack & Enhanced ModuleFederationPlugin support
    return plugin._options;
  } else if (plugin.config) {
    // Repack support
    return plugin.config;
  }
  return undefined;
}
