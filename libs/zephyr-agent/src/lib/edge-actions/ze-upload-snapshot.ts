import { type Snapshot } from 'zephyr-edge-contract';
import { createHash } from 'crypto';
import type { ZephyrEngine } from '../../zephyr-engine';
import { ZeErrors, ZephyrError } from '../errors';
import { uploadSnapshot } from '../http/upload-snapshot';
import { green, yellow } from '../logging/picocolor';

interface ZeUploadSnapshotProps {
  snapshot: Snapshot;
}

export async function zeUploadSnapshot(
  zephyr_engine: ZephyrEngine,
  { snapshot }: ZeUploadSnapshotProps
): Promise<string> {
  const zeStart = Date.now();
  const application_uid = zephyr_engine.application_uid;
  const logger = await zephyr_engine.logger;
  const buildEnv = zephyr_engine.env.isCI ? 'ci' : 'local';

  // const envs = (process.env as unknown as Record<string, string | undefined>) || {};
  const envs = process.env;
  const new_ze_envs: Record<string, string> = {};
  for (const [key, value] of Object.entries(envs)) {
    if (key.startsWith('ZE_PUBLIC_') && typeof value === 'string')
      new_ze_envs[key] = value;
  }
  snapshot.ze_envs = Object.assign({}, snapshot.ze_envs || {}, new_ze_envs);
  
  // Log what we're collecting
  console.log('[ze-upload-snapshot] Collected ZE_PUBLIC_ env vars:', new_ze_envs);
  console.log('[ze-upload-snapshot] Final snapshot.ze_envs:', snapshot.ze_envs);

  // Store snapshot with env vars on the engine for later use
  zephyr_engine.snapshot_with_envs = snapshot;

  // Generate hash for environment variables with application scope
  // Note: Using application names as pseudo-IDs since we don't have DB IDs here
  // The API will need to resolve these to actual IDs
  if (snapshot.ze_envs && Object.keys(snapshot.ze_envs).length > 0) {
    const sortedEnvs = Object.keys(snapshot.ze_envs)
      .sort()
      .reduce((sorted: Record<string, string>, key) => {
        sorted[key] = snapshot.ze_envs![key];
        return sorted;
      }, {});

    const canonical = {
      org: zephyr_engine.applicationProperties.org,
      project: zephyr_engine.applicationProperties.project,
      application: zephyr_engine.applicationProperties.name,
      variables: sortedEnvs
    };

    const hash = createHash('sha256');
    hash.update(JSON.stringify(canonical));
    (snapshot as any).ze_envs_hash = hash.digest('hex');
    
    console.log('[ze-upload-snapshot] Generated ze_envs_hash:', (snapshot as any).ze_envs_hash);
  } else {
    console.log('[ze-upload-snapshot] No ze_envs to hash');
  }

  const edgeTodo = await uploadSnapshot({
    body: snapshot,
    application_uid,
  });

  const versionUrl = edgeTodo?.urls?.version;

  if (!versionUrl) {
    logger({
      level: 'error',
      action: 'snapshot:upload:failed',
      message: `failed uploading of ${buildEnv} snapshot to zephyr`,
    });

    throw new ZephyrError(ZeErrors.ERR_SNAPSHOT_UPLOADS_NO_RESULTS);
  }

  logger({
    level: 'info',
    action: 'snapshot:upload:done',
    message: `Uploaded ${green(buildEnv)} snapshot in ${yellow(`${Date.now() - zeStart}`)}ms`,
  });

  return versionUrl;
}
