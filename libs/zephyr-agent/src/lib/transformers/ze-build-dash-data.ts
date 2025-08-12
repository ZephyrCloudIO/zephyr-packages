import type { ZephyrBuildStats } from 'zephyr-edge-contract';
import type { ZephyrEngine } from '../../zephyr-engine';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';

export async function zeBuildDashData(
  zephyr_engine: ZephyrEngine
): Promise<ZephyrBuildStats> {
  const snapshotId = await zephyr_engine.snapshotId;
  const buildId = await zephyr_engine.build_id;
  if (!snapshotId) {
    throw new ZephyrError(ZeErrors.ERR_SNAPSHOT_ID_NOT_FOUND);
  }

  if (!buildId) {
    throw new ZephyrError(ZeErrors.ERR_GET_BUILD_ID);
  }

  const application_uid = zephyr_engine.application_uid;
  const isCI = zephyr_engine.env.isCI;

  const git = zephyr_engine.gitProperties.git;
  const app = zephyr_engine.applicationProperties;
  const name = zephyr_engine.applicationProperties.name;

  const {
    EDGE_URL: edge_url,
    username,
    DELIMITER: delimiter,
  } = await zephyr_engine.application_configuration;

  const to_raw = _recordToRawDependency;

  // Build zephyr:dependencies from federated_dependencies
  const zephyrDependencies: ZephyrBuildStats['zephyr:dependencies'] = {};
  if (zephyr_engine.federated_dependencies) {
    ze_log.buildstats('Building zephyr:dependencies for dashboard');
    ze_log.buildstats(
      `Processing ${zephyr_engine.federated_dependencies.length} federated dependencies`
    );

    for (const dep of zephyr_engine.federated_dependencies) {
      zephyrDependencies[dep.name] = {
        application_uid: dep.application_uid,
        remote_entry_url: dep.remote_entry_url,
        default_url: dep.default_url,
        name: dep.name,
        library_type: dep.library_type || 'module',
      };
      ze_log.buildstats(`Added ${dep.name} to dashboard data`);
    }
  } else {
    ze_log.buildstats('No federated dependencies to add to dashboard data');
  }

  const result = {
    id: application_uid,
    name,
    environment: '',
    edge: { url: edge_url, delimiter },
    app: Object.assign({}, app, {
      buildId,
    }),
    version: snapshotId,
    git,
    context: { isCI, username },
    dependencies: to_raw(zephyr_engine.npmProperties.dependencies),
    devDependencies: to_raw(zephyr_engine.npmProperties.devDependencies),
    optionalDependencies: to_raw(zephyr_engine.npmProperties.optionalDependencies),
    peerDependencies: to_raw(zephyr_engine.npmProperties.peerDependencies),

    overrides: [],
    consumes: [],
    modules: [],
    remotes: zephyr_engine.federated_dependencies?.map((r) => r.name) ?? [],
    tags: [],
    project: '',
    metadata: {},
    default: false,
    remote: 'remoteEntry.js',
    type: 'app',
    'zephyr:dependencies': zephyrDependencies,
  };

  ze_log.buildstats(
    `Dashboard data created with ${Object.keys(zephyrDependencies).length} zephyr:dependencies`
  );

  return result;
}

interface RawDependency {
  name: string;
  version: string;
}

function _recordToRawDependency(
  record: Record<string, string> | undefined
): RawDependency[] {
  if (!record) return [];
  return Object.entries(record).map(([name, version]) => ({ name, version }));
}
