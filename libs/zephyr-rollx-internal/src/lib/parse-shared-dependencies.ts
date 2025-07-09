import { resolveCatalogDependencies, ZephyrEngine } from 'zephyr-agent';
import { XFederatedSharedConfig } from '../types';

export function parseSharedDependencies(
  name: string,
  config: unknown,
  zephyr_engine: ZephyrEngine
): {
  id: string;
  name: string;
  version: string;
  location: string;
  applicationID: string;
} {
  // Module Federation allows shared to be an object, array, or string
  // Get version from package dependencies if available or from config
  let version = '0.0.0';

  if (zephyr_engine.npmProperties.dependencies?.[name]) {
    // Resolve catalog reference in dependencies if present
    const depVersion = zephyr_engine.npmProperties.dependencies[name];
    version = depVersion.startsWith('catalog:')
      ? resolveCatalogDependencies({ [name]: depVersion })[name]
      : depVersion;
  } else if (zephyr_engine.npmProperties.peerDependencies?.[name]) {
    // Resolve catalog reference in peer dependencies if present
    const peerVersion = zephyr_engine.npmProperties.peerDependencies[name];
    version = peerVersion.startsWith('catalog:')
      ? resolveCatalogDependencies({ [name]: peerVersion })[name]
      : peerVersion;
  } else if (typeof config === 'object' && config !== null) {
    // Object format: { react: { requiredVersion: '18.0.0', singleton: true } }
    if ((config as XFederatedSharedConfig).requiredVersion) {
      const reqVersion = (config as XFederatedSharedConfig).requiredVersion;

      if (reqVersion) {
        version =
          typeof reqVersion === 'string' && reqVersion.startsWith('catalog:')
            ? resolveCatalogDependencies({ [name]: reqVersion })[name]
            : reqVersion;
      }
    }
  } else if (typeof config === 'string') {
    // String format: { react: '18.0.0' }
    // Only use string value if we didn't find the package in dependencies
    if (
      !zephyr_engine.npmProperties.dependencies?.[name] &&
      !zephyr_engine.npmProperties.peerDependencies?.[name]
    ) {
      version = config.startsWith('catalog:')
        ? resolveCatalogDependencies({ [name]: config })[name]
        : config;
    }
  }
  // Array format is also possible but doesn't typically include version info

  return {
    id: name,
    name,
    version,
    location: name,
    applicationID: name,
  };
}
