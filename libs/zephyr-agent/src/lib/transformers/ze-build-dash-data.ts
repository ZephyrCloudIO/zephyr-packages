import type { ZephyrEngine } from '../../zephyr-engine';
import type { ZephyrBuildStats } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import type { SnapshotVariables } from 'libs/zephyr-edge-contract/dist';

export async function zeBuildDashData(
  zephyr_engine: ZephyrEngine,
  variables?: SnapshotVariables
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
    variables,

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
