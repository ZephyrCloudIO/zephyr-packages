import {
  ModuleFederationPlugin,
  WebpackConfiguration,
} from '../types/missing-webpack-types';
import { iterateFederationConfig } from './iterate-federation-config';

export function makeCopyOfModuleFederationOptions(
  config: WebpackConfiguration
): ModuleFederationPlugin[] | undefined {
  return iterateFederationConfig(config, (plugin) => {
    return JSON.parse(JSON.stringify(plugin._options));
  });
}
