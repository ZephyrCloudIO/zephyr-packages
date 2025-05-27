import { flatCreateSnapshotId } from 'zephyr-edge-contract';
import { get_hash_list } from '../lib/edge-hash-list/distributed-hash-control';
import { getBuildId } from '../lib/edge-requests/get-build-id';
import { ze_log } from '../lib/logging';
import { logger, type ZeLogger } from '../lib/logging/ze-log-event';
import type { CreateZephyrEngineResult } from './create_zephyr_engine';

export async function start_new_build_for_engine(
  ze: CreateZephyrEngineResult
): Promise<void> {
  ze_log('Starting new build');
  ze.build_start_time = Date.now();

  const buildId = await ze.build_id;
  const snapshotId = await ze.snapshotId;
  if (buildId && snapshotId) {
    ze_log('Skip: creating new build because no assets were uploaded');
    return;
  }

  const application_uid = ze.application_uid;

  ze_log('Initializing: loading of hash list');
  ze.hash_list = get_hash_list(application_uid);
  ze.hash_list
    .then((hash_set) => {
      ze.resolved_hash_list = hash_set;
      ze_log(`Loaded: hash list with ${hash_set.hash_set.size} entries`);
    })
    .catch((err) => ze_log(`Failed to get hash list: ${err}`));

  ze_log('Initializing: loading of build id');
  ze.build_id = getBuildId(application_uid);
  ze.build_id
    .then((buildId) => ze_log(`Loaded build id "${buildId}"`))
    .catch((err) => ze_log(`Failed to get build id: ${err}`));

  if (ze.logger === undefined) {
    ze_log('Initializing: logger');
    let resolve: (value: ZeLogger) => void;
    ze.logger = new Promise<ZeLogger>((r) => (resolve = r));

    void Promise.all([ze.application_configuration, ze.build_id]).then((record) => {
      const buildId = record[1];
      ze_log('Initialized: application configuration, build id and hash list');

      resolve(logger({ application_uid, buildId, git: ze.gitProperties.git }));
    });
  }

  ze.snapshotId = Promise.all([ze.application_configuration, ze.build_id]).then(
    async (record) =>
      flatCreateSnapshotId({
        ...ze.applicationProperties,
        buildId: record[1],
        username: record[0].username,
      })
  );
}
