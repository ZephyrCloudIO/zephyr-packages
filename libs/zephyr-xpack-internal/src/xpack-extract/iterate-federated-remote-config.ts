import { logFn, ze_log } from 'zephyr-agent';
import type { XFederatedRemotesConfig, XPackConfiguration } from '../xpack.types';
import { extractFederatedConfig } from './extract-federation-config';
import { isModuleFederationPlugin } from './is-module-federation-plugin';

export function iterateFederatedRemoteConfig<Compiler, K = XFederatedRemotesConfig>(
  config: XPackConfiguration<Compiler>,
  for_remote: (federatedRemoteConfig: XFederatedRemotesConfig) => K
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
    results.push(for_remote(federatedConfig));
  }
  ze_log('iterateFederatedRemoteConfig.results', results);

  return results;
}
