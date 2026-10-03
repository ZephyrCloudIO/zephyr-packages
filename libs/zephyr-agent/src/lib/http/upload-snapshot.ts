import {
  forEachLimit,
  type Snapshot,
  type SnapshotUploadRes,
} from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../edge-requests/get-application-configuration';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';
import type { EnvironmentConfig } from '../node-persist/upload-provider-options';
import { type HttpResponse, makeRequest } from './http-request';

/** Edge reply when a snapshot references files the edge no longer stores. */
const MISSING_ASSETS_STATUS = 409;
const MISSING_ASSETS_ERROR = 'missing_assets';
/** Upper bound of hashes attached to error data, so terminal output stays readable. */
const MAX_REPORTED_HASHES = 20;

export interface SnapshotMissingAssets {
  /** Content hashes (assetsMap keys) the edge reported as missing. */
  hashes: string[];
  /** Edge target which rejected the snapshot. */
  edgeUrl: string;
}

/** Restores the reported files on the given edge before the snapshot upload is retried. */
export type OnSnapshotMissingAssets = (missing: SnapshotMissingAssets) => Promise<void>;

const MAX_SNAPSHOT_TARGET_CONCURRENCY = 3;

interface SnapshotTargetConfiguration {
  EDGE_URL: string;
  ENVIRONMENTS?: Record<string, EnvironmentConfig>;
}

interface SnapshotUploadTarget {
  edgeUrl: string;
  snapshot: Snapshot;
}

function canonicalEdgeUrl(edgeUrl: string): string {
  return new URL(edgeUrl).toString();
}

function snapshotForTarget(snapshot: Snapshot, edgeUrl: string): Snapshot {
  return {
    ...snapshot,
    domain: edgeUrl,
  };
}

/** Build a deterministic, deduplicated upload plan without changing snapshot identity. */
export function createSnapshotUploadTargets(
  snapshot: Snapshot,
  config: SnapshotTargetConfiguration
): SnapshotUploadTarget[] {
  const targets = new Map<string, SnapshotUploadTarget>();

  const addTarget = (edgeUrl: string) => {
    const canonicalUrl = canonicalEdgeUrl(edgeUrl);
    if (targets.has(canonicalUrl)) {
      return;
    }

    targets.set(canonicalUrl, {
      edgeUrl,
      snapshot: snapshotForTarget(snapshot, edgeUrl),
    });
  };

  // Keep the primary edge first; sort named environments so request order and duplicate
  // resolution do not depend on object insertion order from the API response.
  addTarget(config.EDGE_URL);
  for (const [, target] of Object.entries(config.ENVIRONMENTS ?? {}).sort(
    ([left], [right]) => left.localeCompare(right)
  )) {
    addTarget(target.edgeUrl);
  }

  return [...targets.values()].map(({ edgeUrl, snapshot: targetSnapshot }) => ({
    edgeUrl,
    snapshot: targetSnapshot,
  }));
}

export async function uploadSnapshot({
  body,
  application_uid,
  onMissingAssets,
}: {
  body: Snapshot;
  application_uid: string;
  /**
   * When set, a `409 missing_assets` reply calls this handler and retries the target's
   * snapshot upload once.
   */
  onMissingAssets?: OnSnapshotMissingAssets;
}): Promise<SnapshotUploadRes> {
  const config = await getApplicationConfiguration({ application_uid });
  const targets = createSnapshotUploadTargets(body, config);
  const [primary, ...additionalTargets] = targets;
  if (!primary) {
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'snapshot',
      cause: new Error('No snapshot upload target was configured.'),
    });
  }

  ze_log.snapshot(
    'Sending target-specific snapshot to edge:',
    JSON.stringify(primary.snapshot, null, 2)
  );
  const resp = await uploadSnapshotToTarget(primary, config.jwt, onMissingAssets);

  await forEachLimit(
    additionalTargets.map(
      (target) => () => uploadSnapshotToTarget(target, config.jwt, onMissingAssets)
    ),
    MAX_SNAPSHOT_TARGET_CONCURRENCY
  );

  ze_log.snapshot('Done: snapshot uploaded');

  return resp;
}

async function uploadSnapshotToTarget(
  target: SnapshotUploadTarget,
  jwt: string,
  onMissingAssets: OnSnapshotMissingAssets | undefined
): Promise<SnapshotUploadRes> {
  const request = {
    json: JSON.stringify(target.snapshot),
    edge_url: target.edgeUrl,
    jwt,
  };

  const [ok, cause, resp] = await doUploadSnapshotRequest(request);
  if (ok) {
    return resp;
  }

  const hashes = getMissingAssetHashes(cause);
  if (!hashes || !onMissingAssets) {
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, { type: 'snapshot', cause });
  }

  ze_log.snapshot(
    `Edge reported ${hashes.length} missing asset(s), restoring them before retrying snapshot upload`
  );
  await onMissingAssets({ hashes, edgeUrl: target.edgeUrl });

  const [retryOk, retryCause, retryResp] = await doUploadSnapshotRequest(request);
  if (retryOk) {
    ze_log.snapshot('Done: snapshot uploaded after restoring missing assets');
    return retryResp;
  }

  const stillMissing = getMissingAssetHashes(retryCause);
  if (stillMissing) {
    throw new ZephyrError(ZeErrors.ERR_SNAPSHOT_MISSING_ASSETS, {
      count: stillMissing.length,
      cause: retryCause,
      data: { missing_hashes: stillMissing.slice(0, MAX_REPORTED_HASHES) },
    });
  }

  throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
    type: 'snapshot',
    cause: retryCause,
  });
}

/**
 * Extracts the hashes from an edge `409 { error: 'missing_assets', hashes }` reply.
 * Returns `undefined` for any other failure.
 */
export function getMissingAssetHashes(error: unknown): string[] | undefined {
  if (!ZephyrError.is(error, ZeErrors.ERR_HTTP_ERROR)) {
    return undefined;
  }

  const { status, content } = (error.template ?? {}) as {
    status?: unknown;
    content?: unknown;
  };
  if (Number(status) !== MISSING_ASSETS_STATUS || typeof content !== 'string') {
    return undefined;
  }

  let body: unknown;
  try {
    body = JSON.parse(content);
  } catch {
    return undefined;
  }

  if (typeof body !== 'object' || body === null) {
    return undefined;
  }

  const { error: reason, hashes } = body as { error?: unknown; hashes?: unknown };
  if (
    reason !== MISSING_ASSETS_ERROR ||
    !Array.isArray(hashes) ||
    hashes.length === 0 ||
    !hashes.every((hash): hash is string => typeof hash === 'string' && hash.length > 0)
  ) {
    return undefined;
  }

  return [...new Set(hashes)];
}

async function doUploadSnapshotRequest({
  json,
  edge_url,
  jwt,
}: {
  json: string;
  edge_url: string;
  jwt: string;
}): Promise<HttpResponse<SnapshotUploadRes>> {
  const options: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Length': Buffer.byteLength(json).toString(),
      'Content-Type': 'application/json; charset=utf-8',
      can_write_jwt: jwt,
    },
  };

  const url = new URL('/upload', edge_url);
  url.searchParams.append('type', 'snapshot');
  url.searchParams.append('skip_assets', 'true');
  ze_log.snapshot('Upload URL:', url.toString());

  return makeRequest<SnapshotUploadRes>(url, options, json);
}
