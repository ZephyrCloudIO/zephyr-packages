import {
  forEachLimit,
  type Snapshot,
  type SnapshotUploadRes,
} from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../edge-requests/get-application-configuration';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';
import type { EnvironmentConfig } from '../node-persist/upload-provider-options';
import { makeRequest } from './http-request';

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
}: {
  body: Snapshot;
  application_uid: string;
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
  const resp = await doUploadSnapshotRequest({
    json: JSON.stringify(primary.snapshot),
    edge_url: primary.edgeUrl,
    jwt: config.jwt,
  });

  await forEachLimit(
    additionalTargets.map(
      (target) => () =>
        doUploadSnapshotRequest({
          json: JSON.stringify(target.snapshot),
          edge_url: target.edgeUrl,
          jwt: config.jwt,
        })
    ),
    MAX_SNAPSHOT_TARGET_CONCURRENCY
  );

  ze_log.snapshot('Done: snapshot uploaded');

  return resp;
}

async function doUploadSnapshotRequest({
  json,
  edge_url,
  jwt,
}: {
  json: string;
  edge_url: string;
  jwt: string;
}): Promise<SnapshotUploadRes> {
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

  const [ok, cause, resp] = await makeRequest<SnapshotUploadRes>(url, options, json);

  if (!ok) {
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'snapshot',
      cause,
    });
  }

  return resp;
}
