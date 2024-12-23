import { isModuleFederationPlugin } from './is-module-federation-plugin';
import { ModuleFederationPlugin, XPackConfiguration } from '../xpack.types';
import { ze_log, ZephyrEngine, ZephyrError, ZeErrors } from 'zephyr-agent';

export function iterateFederationConfig<K, Compiler>(
  zephyr_engine: ZephyrEngine,
  config: XPackConfiguration<Compiler>,
  for_plugin: (plugin: ModuleFederationPlugin['_options']) => K
): K[] {
  const results: K[] = [];
  if (!config.plugins) {
    return results;
  }
  for (const plugin of config.plugins) {
    if (isModuleFederationPlugin(plugin)) {
      plugin._options
        ? results.push(for_plugin(plugin._options))
        : results.push(for_plugin(plugin.config));
    }
  }
  ze_log('iterateFederationConfig.results', results);

  return results;
}
