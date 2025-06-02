import { iterateFederationConfig } from './iterate-federation-config';
import type { ModuleFederationPlugin, XPackConfiguration } from '../xpack.types';

export function makeCopyOfModuleFederationOptions<Compiler>(
  config: XPackConfiguration<Compiler>
): ModuleFederationPlugin[] | undefined {
  return iterateFederationConfig(config, (plugin) => {
    if (!plugin) return;
    return JSON.parse(JSON.stringify(plugin));
  }).filter(Boolean);
}
