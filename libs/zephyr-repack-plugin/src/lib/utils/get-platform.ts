import { Configuration } from '@rspack/core';
import { DelegateConfig } from '../../type/zephyr-internal-types';
import { XPackConfiguration } from 'zephyr-xpack-internal';
import { Compiler } from '@rspack/core';
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

// Find out whether this is ios, android, or other platform build
type Platform = DelegateConfig['target'];
export function get_platform_from_repack(config: Configuration): Platform {
  return config.plugins
    ?.filter(is_repack_plugin)
    ?.map((plugin: any) => plugin.config.platform)[0];
}
