import { iterateFederationConfig } from './iterate-federation-config';
import { ModuleFederationPlugin, XPackConfiguration } from '../xpack.types';
import { ZephyrEngine, ze_log } from 'zephyr-agent';

export function makeCopyOfModuleFederationOptions<Compiler>(
  zephyr_engine: ZephyrEngine,
  config: XPackConfiguration<Compiler>
): ModuleFederationPlugin[] | undefined {
  ze_log('build_type', zephyr_engine.build_type);
  return iterateFederationConfig(zephyr_engine, config, (plugin) => {
    if (!plugin) return;
    return JSON.parse(JSON.stringify(plugin));
  });
}
