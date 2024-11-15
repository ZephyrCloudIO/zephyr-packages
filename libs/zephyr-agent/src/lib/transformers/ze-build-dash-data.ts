import { ZephyrEngine } from '../../zephyr-engine';
import { ZephyrBuildStats } from 'zephyr-edge-contract';

export async function zeBuildDashData(
  zephyr_engine: ZephyrEngine
): Promise<ZephyrBuildStats> {
  const snapshotId = await zephyr_engine.snapshotId;
  const buildId = await zephyr_engine.build_id;
  if (!snapshotId || !buildId) {
    // todo: cc @zmzlois new error type :)
    throw new Error('Missing snapshotId or buildId');
  }

  const application_uid = zephyr_engine.application_uid;
  const isCI = zephyr_engine.env.isCI;

  const git = zephyr_engine.gitProperties.git;
  const app = zephyr_engine.applicationProperties;
  const name = zephyr_engine.applicationProperties.name;

  const edge_url = (await zephyr_engine.application_configuration).EDGE_URL;
  const username = (await zephyr_engine.application_configuration).username;

  const to_raw = _recordToRawDependency;

  return {
    id: application_uid,
    name,
    environment: '',
    edge: { url: edge_url },
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
    remotes: [],
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
