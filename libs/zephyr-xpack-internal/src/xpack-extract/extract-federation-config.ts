import type { ModuleFederationPlugin, XFederatedRemotesConfig } from '../xpack.types';

function normalizeFederationConfig(
  options:
    | XFederatedRemotesConfig
    | {
        config: XFederatedRemotesConfig;
      }
): XFederatedRemotesConfig {
  const config = 'config' in options ? options.config : options;
  return {
    ...config,
    filename: config.filename ?? 'remoteEntry.js',
  };
}

export function extractFederatedConfig(
  plugin: ModuleFederationPlugin
): XFederatedRemotesConfig | undefined {
  if (!plugin) return undefined;
  if (plugin._options) {
    // Webpack, Enhanced MF, and Nx plugins expose serializable options here.
    return normalizeFederationConfig(plugin._options);
  }
  if (plugin.options) {
    // Some Nx/plugin wrappers use `options` instead of `_options`.
    return normalizeFederationConfig(plugin.options);
  }
  if (plugin.config) {
    // Repack support
    return normalizeFederationConfig(plugin.config);
  }
  return undefined;
}
