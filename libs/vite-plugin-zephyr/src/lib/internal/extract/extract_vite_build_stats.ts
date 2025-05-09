import type { OutputBundle } from 'rollup';
import type { ZephyrEngine } from 'zephyr-agent';
import type { ModuleFederationOptions } from '../../vite-plugin-zephyr';
import type { ZephyrBuildStats } from 'zephyr-edge-contract';
import { ze_log } from 'zephyr-agent';

interface ViteBuildStatsOptions {
  zephyr_engine: ZephyrEngine;
  bundle: OutputBundle;
  mfConfig?: ModuleFederationOptions;
}

/**
 * Extract build statistics specific to Vite builds Similar to webpack's getBuildStats but
 * tailored for Vite
 */
export async function extractViteBuildStats({
  zephyr_engine,
  bundle,
  mfConfig,
}: ViteBuildStatsOptions): Promise<ZephyrBuildStats> {
  ze_log('Extracting Vite build stats');

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

  const consumes = Object.keys(mfConfig?.remotes || {}).map((remote) => ({
    consumingApplicationID: application_uid,
    applicationID: remote,
    name: remote,
    usedIn: [],
  }));

  // Extract shared dependencies from Module Federation config
  const overrides = mfConfig?.shared
    ? Object.entries(mfConfig.shared).map(([name, config]) => {
        // Module Federation allows shared to be an object, array, or string
        // Get version from package dependencies if available or from config
        let version = '0.0.0';

        if (zephyr_engine.npmProperties.dependencies?.[name]) {
          version = zephyr_engine.npmProperties.dependencies[name];
        } else if (zephyr_engine.npmProperties.peerDependencies?.[name]) {
          version = zephyr_engine.npmProperties.peerDependencies[name];
        } else if (typeof config === 'object' && config !== null) {
          // Object format: { react: { requiredVersion: '18.0.0', singleton: true } }
          if (config.requiredVersion) {
            version = config.requiredVersion;
          }
        } else if (typeof config === 'string') {
          // String format: { react: '18.0.0' }
          // Only use string value if we didn't find the package in dependencies
          if (
            !zephyr_engine.npmProperties.dependencies?.[name] &&
            !zephyr_engine.npmProperties.peerDependencies?.[name]
          ) {
            version = config;
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
    dependencies: getPackageDependencies(zephyr_engine.npmProperties.dependencies),
    devDependencies: getPackageDependencies(zephyr_engine.npmProperties.devDependencies),
    optionalDependencies: getPackageDependencies(
      zephyr_engine.npmProperties.optionalDependencies
    ),
    peerDependencies: getPackageDependencies(
      zephyr_engine.npmProperties.peerDependencies
    ),
    consumes,
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

function calculateBundleSize(bundle: OutputBundle): number {
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
  mfConfig: ModuleFederationOptions | undefined,
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
          ? String(filePath.import)
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
            .map((item) => {
              return typeof item === 'string'
                ? item
                : typeof item === 'object' && item !== null && 'libraryName' in item
                  ? String((item as { libraryName: string }).libraryName)
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
          .map((item) =>
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
