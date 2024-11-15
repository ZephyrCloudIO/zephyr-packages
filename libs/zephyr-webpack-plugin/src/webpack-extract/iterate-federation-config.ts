import {
  ModuleFederationPlugin,
  WebpackConfiguration,
} from '../types/missing-webpack-types';
import { isModuleFederationPlugin } from './is-module-federation-plugin';

export function iterateFederationConfig<T>(
  config: WebpackConfiguration,
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
