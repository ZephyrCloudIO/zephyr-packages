import { ZephyrEngine } from 'zephyr-agent';
import type { ZephyrBuildStats } from 'zephyr-edge-contract';

// TODO: This is a temporary function to create minimal build stats for Metro. Need to be replaced with the one from zephyr-agent
export async function create_minimal_build_stats(
  zephyr_engine: ZephyrEngine
): Promise<ZephyrBuildStats> {
  const app = zephyr_engine.applicationProperties;
  const { git } = zephyr_engine.gitProperties;
  const { isCI } = zephyr_engine.env;
  const version = await zephyr_engine.snapshotId;
  const application_uid = zephyr_engine.application_uid;
  const buildId = await zephyr_engine.build_id;
  const { EDGE_URL, PLATFORM, DELIMITER } = await zephyr_engine.application_configuration;

  return {
    id: application_uid,
    name: app.name,
    edge: { url: EDGE_URL, delimiter: DELIMITER },
    domain: undefined,
    platform: PLATFORM as unknown as ZephyrBuildStats['platform'],
    type: 'lib',
    app: Object.assign({}, app, { buildId }),
    version,
    git,
    remote: 'remoteEntry.js',
    remotes: [],
    context: { isCI },
    project: app.name,
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
      hasFederation: false,
    },
    default: false,
    environment: '',
  } as ZephyrBuildStats;
}
