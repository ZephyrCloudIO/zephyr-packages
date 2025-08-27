import { ze_log } from 'zephyr-agent';
import type { ModuleFederationPlugin, XPackConfiguration } from '../xpack.types';
import { isModuleFederationPlugin } from './is-module-federation-plugin';

export function iterateFederationConfig<Compiler, K = ModuleFederationPlugin>(
  config: XPackConfiguration<Compiler>,
  for_remote: (plugin: ModuleFederationPlugin) => K
): K[] {
  if (!config.plugins) {
    return [];
  }

  const results: K[] = [];
  for (const plugin of config.plugins) {
    if (!isModuleFederationPlugin(plugin)) {
      continue;
    }
    results.push(for_remote(plugin));
  }
  ze_log.mf('iterateFederationConfig.results', results);

  return results;
}
