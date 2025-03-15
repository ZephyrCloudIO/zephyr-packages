import { Configuration } from '@rspack/core';
import { DelegateConfig } from '../../type/zephyr-internal-types';
import { XPackConfiguration } from 'zephyr-xpack-internal';
import { Compiler } from '@rspack/core';
import { ze_log, ZephyrEngine } from 'zephyr-agent';
import { ZephyrRepackPluginOptions } from '../ze-repack-plugin';
type Plugin = NonNullable<XPackConfiguration<Compiler>['plugins']>[number];

export function is_repack_plugin(plugin?: Plugin) {
  if (!plugin || typeof plugin !== 'object') {
    return false;
  }
  return (
    plugin.constructor.name.includes('RepackPlugin') ||
    plugin['name']?.includes('RepackPlugin')
  );
}

export class PlatformPlugin {
  _zephyr_engine: ZephyrRepackPluginOptions['zephyr_engine'];

  constructor(engine: Pick<ZephyrRepackPluginOptions, 'zephyr_engine'>) {
    this._zephyr_engine = engine.zephyr_engine;
  }

  apply(compiler: Compiler): void {
    compiler.hooks.beforeCompile.tap('PlatformPlugin', () => {
      this._zephyr_engine.env.target = compiler.options.name as Platform;
      ze_log('PlatformPlugin run - platform: ', this._zephyr_engine.env.target);
    });
  }
}

// Find out whether this is ios, android, or other platform build
type Platform = DelegateConfig['target'];

export interface RePackConfiguration extends Configuration {
  platform: Platform;
}
export function get_platform_from_repack(
  config: RePackConfiguration,
  zephyr_engine: ZephyrEngine
): number | undefined {
  ze_log('get_platform_from_repack.config.platform', config.platform);

  return config.plugins?.push(new PlatformPlugin({ zephyr_engine }));
  // return config.plugins
  //   ?.filter(is_repack_plugin)
  //   ?.map((plugin: any) => plugin.config.platform)[0] ?? config.platform;
}
