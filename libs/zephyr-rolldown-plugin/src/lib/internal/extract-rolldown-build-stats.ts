import type { OutputBundle, OutputChunk } from 'rolldown';
import type { ZephyrEngine } from 'zephyr-agent';
import type { ZephyrBuildStats } from 'zephyr-edge-contract';
import { ze_log } from 'zephyr-agent';
import type { RolldownModuleFederationConfig } from '../zephyr-rolldown-plugin';

interface RolldownBuildStatsOptions {
  zephyr_engine: ZephyrEngine;
  bundle: OutputBundle;
  mfConfig?: RolldownModuleFederationConfig | undefined;
}

/** Extract build statistics specific to Rolldown builds */
export async function extractRolldownBuildStats({
  zephyr_engine,
  bundle,
  mfConfig,
}: RolldownBuildStatsOptions): Promise<ZephyrBuildStats> {
  ze_log('Extracting Rolldown build stats');

  const app = zephyr_engine.applicationProperties;
  const { git } = zephyr_engine.gitProperties;
  const { isCI } = zephyr_engine.env;

  // Get IDs and configurations
  const version = await zephyr_engine.snapshotId;
  const application_uid = zephyr_engine.application_uid;
  const buildId = await zephyr_engine.build_id;
  const { EDGE_URL, PLATFORM, DELIMITER } = await zephyr_engine.application_configuration;

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

  const remotes = Object.keys(mfConfig?.remotes || {});

  const consumes = Object.keys(mfConfig?.remotes || {}).map((remote) => ({
    consumingApplicationID: application_uid,
    applicationID: remote,
    name: remote,
    usedIn: [],
  }));

  const overrides = Object.keys(mfConfig?.shared || {}).map((shared) => ({
    id: shared,
    name: shared,
    version: mfConfig?.shared[shared],
    location: shared,
    applicationID: shared,
  }));

  const modules = Object.keys(mfConfig?.exposes || {}).map((expose) => ({
    id: expose,
    name: expose,
    applicationID: application_uid,
    requires: [],
    file: expose,
  }));

  // Build the stats object
  const buildStats: ZephyrBuildStats = {
    id: application_uid,
    name: app.name,
    edge: { url: EDGE_URL, delimiter: DELIMITER },
    domain: undefined,
    platform: PLATFORM as unknown as ZephyrBuildStats['platform'],
    type: 'lib',
    app: Object.assign({}, app, { buildId }),
    version,
    git,
    remote: '',
    remotes,
    context: { isCI },
    project: app.name,
    tags: [],

    // Dependencies from package.json
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
    modules,

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
