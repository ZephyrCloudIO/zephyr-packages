import type { ZephyrEngine } from 'zephyr-agent';
import {
  create_minimal_build_stats,
  resolveCatalogDependencies,
  ze_log,
} from 'zephyr-agent';
import type { ApplicationConsumes, ZephyrBuildStats } from 'zephyr-edge-contract';
import type {
  ModuleFederationPlugin,
  XFederatedConfig,
  XFederatedSharedConfig,
  XOutputAsset,
  XOutputBundle,
  XOutputChunk,
} from '../xpack.types';
import { viteLikeRemoteRegex } from './vite-like-remote-regex';

interface XViteBuildStatsOptions {
  zephyr_engine: ZephyrEngine;
  bundle: XOutputBundle<XOutputChunk | XOutputAsset>;
  mfConfig?: XFederatedConfig;
  root: string;
  // consumes?: ApplicationConsumes[]; // Add option to provide already discovered imports
}
/**
 * Extract build statistics specific to Vite builds Similar to webpack's getBuildStats but
 * tailored for Vite
 */
export async function extractXViteBuildStats({
  zephyr_engine,
  bundle,
  mfConfig,
  root,
  // consumes,
}: XViteBuildStatsOptions): Promise<ZephyrBuildStats> {
  ze_log('Extracting Vite build stats');

  const consumeMap = new Map<string, ApplicationConsumes>();
  if (!bundle) {
    ze_log('No bundle found, returning minimal stats');
    // Return minimal stats object when bundle is null
    const minimal_build_stats = await create_minimal_build_stats(zephyr_engine);

    Object.assign(minimal_build_stats, {
      name: mfConfig?.name || zephyr_engine.applicationProperties.name,
      remote: mfConfig?.filename || 'remoteEntry.js',
      remotes: mfConfig?.remotes ? Object.keys(mfConfig.remotes) : [],
      metadata: {
        hasFederation: !!mfConfig,
      },
    });
    return minimal_build_stats;
  }

  const app = zephyr_engine.applicationProperties;
  const { git } = zephyr_engine.gitProperties;
  const { isCI } = zephyr_engine.env;

  // Get IDs and configurations
  const version = await zephyr_engine.snapshotId;
  const application_uid = zephyr_engine.application_uid;
  const buildId = await zephyr_engine.build_id;
  const { EDGE_URL, PLATFORM, DELIMITER } = await zephyr_engine.application_configuration;

  // Extract information from Module Federation config if available
  const name = mfConfig?.name || app.name;
  const filename = mfConfig?.filename || 'remoteEntry.js';
  const remotes = mfConfig?.remotes ? Object.keys(mfConfig.remotes) : [];

  // Get bundle stats
  const totalSize = calculateBundleSize(bundle);
  const fileCount = Object.keys(bundle).length;
  const chunkCount = Object.values(bundle).filter((item) => item.type === 'chunk').length;
  const assetCount = Object.values(bundle).filter((item) => item.type === 'asset').length;
  // once we have the chunk and remote's name, we can find the imported remote, what's their used components and where they are being referenced

  // Process the bundle to find the loadRemote calls using multiple regex patterns
  Object.values(bundle)
    .filter((item) => item.type === 'chunk')
    .forEach((chunk) => {
      try {
        const code = chunk.code;

        // Try each regex pattern
        for (const pattern of viteLikeRemoteRegex) {
          // Reset lastIndex to search from beginning
          pattern.lastIndex = 0;

          let match;
          while ((match = pattern.exec(code)) !== null) {
            // The match array structure depends on the regex pattern
            let remoteName, componentName;

            if (match.length === 3) {
              // First pattern: loadRemote("remote/component")
              remoteName = match[1];
              componentName = match[2];
            } else if (match.length === 6) {
              // Second pattern: destructured variant
              remoteName = match[4];
              componentName = match[5];
            } else if (match.length >= 3) {
              // Third pattern: promise chain
              remoteName = match[1];
              componentName = match[2];
            }

            if (remoteName && componentName) {
              consumeMap.set(`${remoteName}-${componentName}`, {
                consumingApplicationID: componentName,
                applicationID: remoteName,
                name: componentName,
                // TODO: move this to moduleParsed hook to process where the remote is being used. Doing this here is too late.
                usedIn: [
                  ...chunk.moduleIds.map((id: string) => ({
                    file: id.replace(root, ''),
                    url: id.replace(root, ''),
                  })),
                ],
              });
              ze_log('Found remote import', { remoteName, componentName });
            }
          }
        }

        // Extra pattern specifically for the promise chain syntax in your example
        const promiseChainPattern =
          /\w+\s*=\s*\w+\.then\(\w+\s*=>\s*\w+\(["']([^/]+)\/([^'"]+)["']\)\)/g;
        let promiseMatch;
        while ((promiseMatch = promiseChainPattern.exec(chunk.code)) !== null) {
          if (promiseMatch.length >= 3) {
            const remoteName = promiseMatch[1];
            const componentName = promiseMatch[2];

            consumeMap.set(`${remoteName}-${componentName}`, {
              consumingApplicationID: componentName,
              applicationID: remoteName,
              name: componentName,
              usedIn: [
                ...chunk.moduleIds.map((id: string) => ({
                  file: id.replace(root, ''),
                  url: id.replace(root, ''),
                })),
              ],
            });
            ze_log('Found remote import in promise chain', { remoteName, componentName });
          }
        }
      } catch (error) {
        ze_log('Error parsing chunk for loadRemote calls', {
          error,
          chunkId: chunk.fileName,
        });
      }
    });

  ze_log('consumeMap', ...consumeMap);

  // Extract shared dependencies from Module Federation config
  const overrides = mfConfig?.shared
    ? Object.entries(mfConfig.shared).map(([name, config]) => {
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
      })
    : [];

  // Build the stats object
  const buildStats = {
    id: application_uid,
    name,
    edge: { url: EDGE_URL, delimiter: DELIMITER },
    domain: undefined,
    platform: PLATFORM as unknown as ZephyrBuildStats['platform'],
    type: 'app',
    app: Object.assign({}, app, { buildId }),
    version,
    git,
    remote: filename,
    remotes,
    context: { isCI },
    project: name,
    tags: [],

    // Module Federation related data
    dependencies: getPackageDependencies(
      resolveCatalogDependencies(zephyr_engine.npmProperties.dependencies)
    ),
    devDependencies: getPackageDependencies(
      resolveCatalogDependencies(zephyr_engine.npmProperties.devDependencies)
    ),
    optionalDependencies: getPackageDependencies(
      resolveCatalogDependencies(zephyr_engine.npmProperties.optionalDependencies)
    ),
    peerDependencies: getPackageDependencies(
      resolveCatalogDependencies(zephyr_engine.npmProperties.peerDependencies)
    ),
    consumes: Array.from(consumeMap.values()),
    overrides,
    modules: extractModulesFromExposes(mfConfig, application_uid),

    // Add Vite-specific metadata
    metadata: {
      bundler: 'vite',
      totalSize,
      fileCount,
      chunkCount,
      assetCount,
      // Include module federation details if available
      hasFederation: !!mfConfig,
    },
    default: false,
    environment: '',
  } as ZephyrBuildStats;

  ze_log('Vite build stats extracted successfully', buildStats);
  return buildStats;
}

function getPackageDependencies(
  dependencies: Record<string, string> | undefined
): Array<{ name: string; version: string }> {
  if (!dependencies) return [];
  return Object.entries(dependencies).map(([name, version]) => ({ name, version }));
}

function calculateBundleSize(bundle: XOutputBundle): number {
  return Object.values(bundle).reduce((size, item) => {
    if (item.type === 'chunk') {
      return size + item.code.length;
    } else if (item.type === 'asset') {
      if (typeof item.source === 'string') {
        return size + item.source.length;
      } else {
        return size + item.source.byteLength;
      }
    }
    return size;
  }, 0);
}

/**
 * Extracts exposed modules from Module Federation configuration Creates formatted module
 * entries for the build stats
 */
function extractModulesFromExposes(
  mfConfig: ModuleFederationPlugin['config'] | undefined,
  applicationID: string
): Array<{
  id: string;
  name: string;
  applicationID: string;
  requires: string[];
  file: string;
}> {
  if (!mfConfig?.exposes) {
    return [];
  }

  // Extract exposed modules from the Module Federation config
  return Object.entries(mfConfig.exposes).map(([exposedPath, filePath]) => {
    // Handle different formats of exposes configuration
    // In Vite ModuleFederation, exposes can be an object where key is the exposed path and value is the file path
    // Example: { './Button': './src/Button' }

    // Normalize the file path (it might be an object in some federation implementations)
    const normalizedFilePath =
      typeof filePath === 'string'
        ? filePath
        : typeof filePath === 'object' && filePath !== null && 'import' in filePath
          ? String((filePath as { import: string }).import)
          : String(filePath);

    // Extract just the module name from the exposed path (removing './')
    const name = exposedPath.startsWith('./') ? exposedPath.substring(2) : exposedPath;

    // Create a unique ID for this module in the format used by Module Federation Dashboard
    const id = `${name}:${name}`;

    // Extract any potential requirements from shared dependencies
    // In a more complete implementation, this would analyze the actual file to find imports
    const requires: string[] = [];

    // If we have shared dependencies and they're an object with keys, use them as requirements
    if (mfConfig.shared) {
      if (Array.isArray(mfConfig.shared)) {
        // Handle array format: ['react', 'react-dom']
        requires.push(
          ...mfConfig.shared
            .map((item: string | XFederatedSharedConfig) => {
              return typeof item === 'string'
                ? item
                : typeof item === 'object' && item !== null && 'libraryName' in item
                  ? String(item.libraryName)
                  : '';
            })
            .filter(Boolean)
        );
      } else if (typeof mfConfig.shared === 'object' && mfConfig.shared !== null) {
        // Handle object format: { react: {...}, 'react-dom': {...} }
        requires.push(...Object.keys(mfConfig.shared));
      }
    }

    // Handle additionalShared format from Nx webpack module federation
    if (mfConfig.additionalShared && Array.isArray(mfConfig.additionalShared)) {
      requires.push(
        ...mfConfig.additionalShared
          .map((item: string | XFederatedSharedConfig) =>
            typeof item === 'object' && item !== null && 'libraryName' in item
              ? String(item.libraryName)
              : ''
          )
          .filter(Boolean)
      );
    }

    return {
      id,
      name,
      applicationID,
      requires,
      file: normalizedFilePath,
    };
  });
}
