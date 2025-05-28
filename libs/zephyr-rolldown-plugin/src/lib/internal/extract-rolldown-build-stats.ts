import type { OutputBundle, OutputChunk } from 'rolldown';
import type { ZephyrEngine } from 'zephyr-agent';
import { resolveCatalogDependencies, ze_log } from 'zephyr-agent';
import type { ApplicationConsumes, ZephyrBuildStats } from 'zephyr-edge-contract';
import type { RolldownModuleFederationConfig } from '../zephyr-rolldown-plugin';

interface RolldownBuildStatsOptions {
  zephyr_engine: ZephyrEngine;
  bundle: OutputBundle;
  mfConfig?: RolldownModuleFederationConfig | undefined;
  root?: string;
}

/** Extract build statistics specific to Rolldown builds */
export async function extractRolldownBuildStats({
  zephyr_engine,
  bundle,
  mfConfig,
  root = process.cwd(),
}: RolldownBuildStatsOptions): Promise<ZephyrBuildStats> {
  ze_log('Extracting Rolldown build stats');

  const consumeMap = new Map<string, ApplicationConsumes>();
  if (!bundle) {
    ze_log('No bundle found, returning minimal stats');
    // Return minimal stats object when bundle is null
    const app = zephyr_engine.applicationProperties;
    const { git } = zephyr_engine.gitProperties;
    const { isCI } = zephyr_engine.env;
    const version = await zephyr_engine.snapshotId;
    const application_uid = zephyr_engine.application_uid;
    const buildId = await zephyr_engine.build_id;
    const { EDGE_URL, PLATFORM, DELIMITER } =
      await zephyr_engine.application_configuration;

    return {
      id: application_uid,
      name: mfConfig?.name || app.name,
      edge: { url: EDGE_URL, delimiter: DELIMITER },
      domain: undefined,
      platform: PLATFORM as unknown as ZephyrBuildStats['platform'],
      type: 'lib',
      app: Object.assign({}, app, { buildId }),
      version,
      git,
      remote: mfConfig?.filename || 'remoteEntry.js',
      remotes: [],
      context: { isCI },
      project: mfConfig?.name || app.name,
      tags: [],
      dependencies: [],
      devDependencies: [],
      optionalDependencies: [],
      peerDependencies: [],
      consumes: [],
      overrides: [],
      modules: [],
      metadata: {
        bundler: 'rolldown',
        totalSize: 0,
        fileCount: 0,
        chunkCount: 0,
        assetCount: 0,
        dynamicImportCount: 0,
        hasFederation: !!mfConfig,
      },
      default: false,
      environment: '',
    } as ZephyrBuildStats;
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

  // Count chunks and collect import/export info
  const chunks = Object.values(bundle).filter(
    (item) => item.type === 'chunk'
  ) as OutputChunk[];
  const chunkCount = chunks.length;
  const assetCount = fileCount - chunkCount;

  // Extract all dynamic imports from chunks
  const dynamicImports = new Set<string>();
  chunks.forEach((chunk) => {
    (chunk.dynamicImports || []).forEach((imp) => dynamicImports.add(imp));
  });

  // Different regex patterns to match various loadRemote call formats
  const regexPatterns = [
    // Basic pattern: loadRemote("remote/component")
    /loadRemote\(["']([^/]+)\/([^'"]+)["']\)/g,

    // Destructured pattern: { loadRemote: c } = a, then c("remote/component")
    /(?:\{[ \t]*loadRemote:[ \t]*([a-zA-Z0-9_$]+)[ \t]*\}|\bloadRemote[ \t]*:[ \t]*([a-zA-Z0-9_$]+)\b).*?([a-zA-Z0-9_$]+)[ \t]*\(["']([^/]+)\/([^'"]+)["']\)/g,

    // Promise chain pattern: n.then(e => c("remote/component"))
    /\.then\([ \t]*(?:[a-zA-Z0-9_$]+)[ \t]*=>[ \t]*(?:[a-zA-Z0-9_$]+)\(["']([^/]+)\/([^'"]+)["']\)\)/g,
  ];

  // Process the bundle to find the loadRemote calls using multiple regex patterns
  chunks.forEach((chunk) => {
    try {
      const code = chunk.code;

      // Try each regex pattern
      for (const pattern of regexPatterns) {
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
            const moduleIds = chunk.facadeModuleId
              ? [chunk.facadeModuleId]
              : Object.keys(chunk.modules || {});

            consumeMap.set(`${remoteName}-${componentName}`, {
              consumingApplicationID: componentName,
              applicationID: remoteName,
              name: componentName,
              usedIn: moduleIds.map((id) => ({
                file: id.replace(root, ''),
                url: id.replace(root, ''),
              })),
            });
            ze_log('Found remote import', { remoteName, componentName });
          }
        }
      }

      // Extra pattern specifically for the promise chain syntax
      const promiseChainPattern =
        /\w+\s*=\s*\w+\.then\(\w+\s*=>\s*\w+\(["']([^/]+)\/([^'"]+)["']\)\)/g;
      let promiseMatch;
      while ((promiseMatch = promiseChainPattern.exec(chunk.code)) !== null) {
        if (promiseMatch.length >= 3) {
          const remoteName = promiseMatch[1];
          const componentName = promiseMatch[2];
          const moduleIds = chunk.facadeModuleId
            ? [chunk.facadeModuleId]
            : Object.keys(chunk.modules || {});

          consumeMap.set(`${remoteName}-${componentName}`, {
            consumingApplicationID: componentName,
            applicationID: remoteName,
            name: componentName,
            // TODO lois: this value is wrong and it's using the output bundle name instead of the original file name, need to be fixed
            usedIn: moduleIds.map((id) => ({
              file: id.replace(root, ''),
              url: id.replace(root, ''),
            })),
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
    ? Object.entries(mfConfig.shared).map(([name, version]) => {
        // Get version from package dependencies if available or from config
        let finalVersion = '0.0.0';

        if (zephyr_engine.npmProperties.dependencies?.[name]) {
          // Resolve catalog reference in dependencies if present
          const depVersion = zephyr_engine.npmProperties.dependencies[name];
          finalVersion = depVersion.startsWith('catalog:')
            ? resolveCatalogDependencies({ [name]: depVersion })[name]
            : depVersion;
        } else if (zephyr_engine.npmProperties.peerDependencies?.[name]) {
          // Resolve catalog reference in peer dependencies if present
          const peerVersion = zephyr_engine.npmProperties.peerDependencies[name];
          finalVersion = peerVersion.startsWith('catalog:')
            ? resolveCatalogDependencies({ [name]: peerVersion })[name]
            : peerVersion;
        } else if (typeof version === 'string') {
          // Resolve catalog reference if present
          finalVersion = version.startsWith('catalog:')
            ? resolveCatalogDependencies({ [name]: version })[name]
            : version;
        }

        return {
          id: name,
          name,
          version: finalVersion,
          location: name,
          applicationID: name,
        };
      })
    : [];

  // Build the stats object
  const buildStats: ZephyrBuildStats = {
    id: application_uid,
    name,
    edge: { url: EDGE_URL, delimiter: DELIMITER },
    domain: undefined,
    platform: PLATFORM as unknown as ZephyrBuildStats['platform'],
    type: 'lib',
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

    // Add Rolldown-specific metadata
    metadata: {
      bundler: 'rolldown',
      totalSize,
      fileCount,
      chunkCount,
      assetCount,
      dynamicImportCount: dynamicImports.size,
      hasFederation: !!mfConfig,
    },
    default: false,
    environment: '',
  } as ZephyrBuildStats;

  ze_log('Rolldown build stats extracted successfully', buildStats);
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
  mfConfig: RolldownModuleFederationConfig | undefined,
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
    // Normalize the file path
    const normalizedFilePath = typeof filePath === 'string' ? filePath : String(filePath);

    // Extract just the module name from the exposed path (removing './')
    const name = exposedPath.startsWith('./') ? exposedPath.substring(2) : exposedPath;

    // Create a unique ID for this module in the format used by Module Federation Dashboard
    const id = `${name}:${name}`;

    // Extract any potential requirements from shared dependencies
    const requires: string[] = [];

    // If we have shared dependencies, use them as requirements
    if (mfConfig.shared) {
      requires.push(...Object.keys(mfConfig.shared));
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
