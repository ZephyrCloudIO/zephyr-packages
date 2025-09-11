import { logFn, ze_log } from 'zephyr-agent';
import type {
  ModuleFederationPlugin,
  XFederatedRemotesConfig,
  XPackConfiguration,
} from '../xpack.types';
import { extractFederatedConfig } from './extract-federation-config';
import { isModuleFederationPlugin } from './is-module-federation-plugin';

export function iterateFederatedRemoteConfig<Compiler, K = XFederatedRemotesConfig>(
  config: XPackConfiguration<Compiler>,
  for_remote: (
    federatedRemoteConfig: XFederatedRemotesConfig,
    plugin: ModuleFederationPlugin
  ) => K
): K[] {
  if (!config.plugins) {
    return [];
  }

  const results: K[] = [];
  for (const plugin of config.plugins) {
    if (!isModuleFederationPlugin(plugin)) {
      continue;
    }

    const federatedConfig = extractFederatedConfig(plugin);

    if (!federatedConfig) {
      logFn(
        'warn',
        `No federated config found for plugin: ${plugin.constructor.name}, skipping...`
      );
      continue;
    }
    results.push(for_remote(federatedConfig, plugin));
  }
  ze_log.remotes('iterateFederatedRemoteConfig.results', results);

  return results;
}
