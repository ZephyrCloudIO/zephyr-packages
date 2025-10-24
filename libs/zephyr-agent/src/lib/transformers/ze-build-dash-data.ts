import type { ZephyrBuildStats } from 'zephyr-edge-contract';
import type { ZephyrEngine } from '../../zephyr-engine';
import { ZeErrors, ZephyrError } from '../errors';

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

  return {
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
    remotes:
      zephyr_engine.federated_dependencies?.map((r) => r.normalized_js_name ?? r.name) ??
      [],
    tags: [],
    project: '',
    metadata: {},
    default: false,
    remote: 'remoteEntry.js',
    type: 'app',
    zephyrDependencies: zephyr_engine.zephyr_dependencies,
    ze_envs: zephyr_engine.ze_env_vars || undefined,
    ze_envs_hash: zephyr_engine.ze_env_vars_hash || undefined,
  };
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
