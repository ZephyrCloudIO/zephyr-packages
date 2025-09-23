import { ze_log } from 'zephyr-agent';
import type { ModuleFederationPlugin, XFederatedRemotesConfig } from '../xpack.types';
import { extractFederatedConfig } from './extract-federation-config';

export function isLegacyMFPlugin(plugin: ModuleFederationPlugin): boolean {
  const options = extractFederatedConfig(plugin);

  if (!options) {
    ze_log.mf('Not a Module Federation plugin');
    return false;
  }

  // If constructor name doesn't match, definitely not webpack's
  if (plugin.constructor.name !== 'ModuleFederationPlugin') {
    ze_log.mf(
      'Non-legacy Module Federation plugin identified. Current plugin name: ',
      plugin.constructor.name
    );
    return false;
  }

  const enhancedFeaturesChecks: Checks[] = [
    // Core enhanced methods (likely present in most versions)
    [plugin, 'getRemoteEntryUrls', 'function'],
    [plugin, 'getContainerEntryModule', 'function'],
    [plugin, 'invalidateRemote', 'function'],
    // Newer enhanced methods (higher version requirements)
    [plugin, 'statsResourceInfo'],
    [plugin, 'getStats', 'function'],
    // Configuration-based detection (version-agnostic)
    [options, 'experiments'],
    [options, 'runtimePlugins'],
    [options, 'enhanced'],
    // Internal properties (likely present across versions)
    [plugin, '_experiments'],
    [plugin, '_enhanced'],
  ];

  for (const check of enhancedFeaturesChecks) {
    if (hasProperty(...check)) {
      ze_log.mf(
        'Non-legacy Module Federation plugin identified. Plugin contains property: ',
        check[1]
      );
      return false; // Has enhanced features, so NOT legacy
    }
  }
  // If we get here, it's webpack's native plugin
  return true;
}

type Checks = [ModuleFederationPlugin | XFederatedRemotesConfig, string, string?];

const hasProperty = (target: any, property: string, type?: string): boolean => {
  const hasProp = property in target;

  if (!(property in target)) return false;

  if (type) return typeof target[property] === type;

  return hasProp;
};
