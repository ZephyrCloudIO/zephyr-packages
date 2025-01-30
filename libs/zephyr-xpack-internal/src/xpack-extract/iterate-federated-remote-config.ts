import { isModuleFederationPlugin } from './is-module-federation-plugin';
import { XFederatedRemotesConfig, XPackConfiguration } from '../xpack.types';
import { ze_log } from 'zephyr-agent';

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
    if (plugin._options) {
      results.push(for_remote(plugin._options));
    } else if (plugin.config) {
      results.push(for_remote(plugin.config));
    }
  }
  ze_log('iterateFederatedRemoteConfig.results', results);

  return results;
}
