import { isModuleFederationPlugin } from './is-module-federation-plugin';
import { ModuleFederationPlugin, XPackConfiguration } from '../xpack.types';

export function iterateFederationConfig<T, Compiler>(
  config: XPackConfiguration<Compiler>,
  for_plugin: (plugin: ModuleFederationPlugin) => T
): T[] {
  const results: T[] = [];
  if (!config.plugins) {
    return results;
  }
  for (const plugin of config.plugins) {
    if (isModuleFederationPlugin(plugin)) {
      results.push(for_plugin(plugin));
    }
  }

  return results;
}
