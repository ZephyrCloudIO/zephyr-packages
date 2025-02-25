import { Configuration } from '@rspack/core';
import { DelegateConfig } from '../../type/zephyr-internal-types';
import { XPackConfiguration } from 'zephyr-xpack-internal';
import { Compiler } from '@rspack/core';
type Plugin = NonNullable<XPackConfiguration<Compiler>['plugins']>[number];

export function is_repack_plugin(plugin?: Plugin) {
  if (!plugin || typeof plugin !== 'object') {
    return false;
  }

  // Check constructor name first
  if (
    typeof plugin.constructor === 'function' &&
    typeof plugin.constructor.name === 'string' &&
    plugin.constructor.name.includes('RepackPlugin')
  ) {
    return true;
  }

  // Then check for name property
  const pluginName = plugin['name'];
  if (typeof pluginName === 'string' && pluginName.includes('RepackPlugin')) {
    return true;
  }

  return false;
}

// Find out whether this is ios, android, or other platform build
type Platform = DelegateConfig['target'];
export function get_platform_from_repack(config: Configuration): Platform {
  const repackPlugins = config.plugins?.filter(is_repack_plugin);
  if (!repackPlugins || repackPlugins.length === 0) {
    return undefined;
  }

  // Safely access plugin.config.platform
  for (const plugin of repackPlugins) {
    if (
      typeof plugin === 'object' &&
      plugin !== null &&
      'config' in plugin &&
      typeof plugin['config'] === 'object' &&
      plugin['config'] !== null &&
      'platform' in plugin['config']
    ) {
      const platform = plugin['config']['platform'];
      if (platform === 'ios' || platform === 'android' || platform === 'web') {
        return platform;
      }
    }
  }

  return undefined;
}
