import { createHash } from 'crypto';
import { type Snapshot } from 'zephyr-edge-contract';
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

  // Collect env vars for hash generation (needed by API)
  // but don't store them in snapshot (they're in the manifest asset)
  const envs = process.env;
  const ze_envs: Record<string, string> = {};
  for (const [key, value] of Object.entries(envs)) {
    if (key.startsWith('ZE_PUBLIC_') && typeof value === 'string') ze_envs[key] = value;
  }

  // Generate hash for environment variables with application scope
  const zeVarsEntries = Object.entries(ze_envs);
  if (zeVarsEntries.length > 0) {
    const sortedVariables = zeVarsEntries
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');

    const canonicalString = `${application_uid}\n${sortedVariables}`;

    const hash = createHash('sha256');
    hash.update(canonicalString, 'utf-8');
    snapshot.ze_envs_hash = hash.digest('hex');

    // Store env vars and hash temporarily on engine for API to use
    // (not in snapshot, just for transmission to API)
    zephyr_engine.ze_env_vars = ze_envs;
    zephyr_engine.ze_env_vars_hash = snapshot.ze_envs_hash;
  }

  // Note: snapshot.ze_envs is no longer set - env vars are in manifest asset

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
