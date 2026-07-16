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
  let config: XFederatedRemotesConfig | undefined;
  if (plugin._options) {
    // Webpack, Enhanced MF, and Nx plugins expose serializable options here.
    config = normalizeFederationConfig(plugin._options);
  } else if (plugin.options) {
    // Some Nx/plugin wrappers use `options` instead of `_options`.
    config = normalizeFederationConfig(plugin.options);
  } else if (plugin.config) {
    // Repack support
    config = normalizeFederationConfig(plugin.config);
  }
  if (!config) return undefined;

  return plugin.configOverride
    ? normalizeFederationConfig({ ...config, ...plugin.configOverride })
    : config;
}
