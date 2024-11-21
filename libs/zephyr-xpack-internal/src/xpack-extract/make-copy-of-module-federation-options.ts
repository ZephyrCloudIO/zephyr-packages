import { iterateFederationConfig } from './iterate-federation-config';
import { ModuleFederationPlugin, XPackConfiguration } from '../xpack.types';

export function makeCopyOfModuleFederationOptions<Compiler>(
  config: XPackConfiguration<Compiler>
): ModuleFederationPlugin[] | undefined {
  return iterateFederationConfig(config, (plugin) => {
    return JSON.parse(JSON.stringify(plugin._options));
  });
}
