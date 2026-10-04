import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import {
  ZE_API_ENDPOINT,
  ze_api_gateway,
  type AttributionRepositoryPolicy,
  type AttributionUploadRequest,
  type AttributionUploadResponse,
  type ChangeAttribution,
} from 'zephyr-edge-contract';
import type { ZeApplicationConfig } from '../node-persist/upload-provider-options';
import { getToken } from '../node-persist/token';
import { makeRequest } from '../http/http-request';
import { readAttributionConfig, type AttributionConfig } from './config';
import { attributionRepository, loadSourceRecord, sourceCommitBaseline } from './source';
import { compareSourceContents } from './compare';

function validPolicy(
  policy: AttributionRepositoryPolicy | undefined
): policy is AttributionRepositoryPolicy {
  return Boolean(
    policy &&
    policy.schemaVersion === 1 &&
    typeof policy.repositoryId === 'string' &&
    /^[a-zA-Z0-9._-]{1,128}$/.test(policy.repositoryId) &&
    typeof policy.revision === 'string' &&
    policy.revision.length > 0 &&
    policy.revision.length <= 128 &&
    ['free', 'paid', 'byoc'].includes(policy.tier) &&
    ['local', 'remote'].includes(policy.storage) &&
    typeof policy.content?.patch === 'boolean' &&
    typeof policy.content?.lines === 'boolean'
  );
}

/** Both repo opt-in and authenticated server policy must authorize remote sharing. */
export function resolveRemoteContent(
  config: AttributionConfig,
  policy: AttributionRepositoryPolicy | undefined
) {
  if (!validPolicy(policy) || policy.storage !== 'remote')
    throw new Error(
      'Remote attribution needs an enabled repository policy from the authenticated service'
    );
  if (config.repositoryId && config.repositoryId !== policy.repositoryId)
    throw new Error('Attribution repository does not match the authenticated policy');
  if (policy.tier === 'free') {
    if (
      config.content?.patch === false ||
      config.content?.lines === false ||
      !policy.content.patch ||
      !policy.content.lines
    )
      throw new Error(
        'Free remote attribution requires patches and changed lines; choose local storage to keep them local'
      );
    return { patch: true, lines: true };
  }
  // Server preferences are a ceiling; a local repo preference can reduce sharing.
  const content = {
    patch: config.content?.patch ?? false,
    lines: config.content?.lines ?? false,
  };
  if (
    (content.patch && !policy.content.patch) ||
    (content.lines && !policy.content.lines)
  )
    throw new Error(
      'Repository content settings exceed the authenticated attribution policy'
    );
  return content;
}

/** Upload private evidence before publishing its reference. No request in local mode. */
export async function publishAttribution({
  directory,
  summary,
  applicationUid,
  buildId,
  snapshotId,
  appConfig,
}: {
  directory: string;
  summary: ChangeAttribution | undefined;
  applicationUid: string;
  buildId: string;
  snapshotId: string;
  appConfig: ZeApplicationConfig;
}): Promise<ChangeAttribution | undefined> {
  let repository;
  try {
    repository = attributionRepository(directory);
  } catch {
    return undefined;
  }
  const { root, gitDir } = repository;
  let config;
  try {
    config = readAttributionConfig(root, gitDir);
  } catch {
    // Unknown or malformed preferences never authorize sharing or block deployment.
    return undefined;
  }
  if (!config?.enabled || (config.storage ?? 'local') === 'local') return undefined;
  if (!summary || summary.status !== 'captured' || !summary.sourceId)
    throw new Error(
      'Remote attribution cannot publish without a complete local source receipt'
    );
  if (summary.storage !== 'remote')
    throw new Error('Attribution storage changed during publication; capture again');
  if (
    appConfig.application_uid !== applicationUid ||
    !applicationUid ||
    !buildId ||
    !snapshotId
  )
    throw new Error(
      'Attribution publication requires matching application and build identities'
    );
  const policy = appConfig.ATTRIBUTION_POLICY;
  const content = resolveRemoteContent(config, policy);
  const record = loadSourceRecord(root, summary.sourceId);
  if (record.fingerprint !== summary.sourceFingerprint)
    throw new Error('Attribution source receipt does not match its fingerprint');
  const payload: AttributionUploadRequest = {
    schemaVersion: 1,
    applicationUid,
    repositoryId: policy!.repositoryId,
    buildId,
    snapshotId,
    policyRevision: policy!.revision,
    content,
    attribution: summary,
  };
  if (content.patch || content.lines) {
    const difference = compareSourceContents(
      sourceCommitBaseline(root, record),
      record,
      root
    );
    payload.comparison = {
      base: 'git-head',
      baseCommit: record.baseCommit,
      changes: difference.changes.map(({ patch, lines, ...metadata }) => ({
        ...metadata,
        ...(content.patch ? { patch } : {}),
        ...(content.lines ? { lines } : {}),
      })),
    };
  }
  const body = JSON.stringify(payload);
  if (Buffer.byteLength(body) > 20 * 1024 * 1024)
    throw new Error(
      'Remote attribution exceeds 20 MiB; reduce the repository capture scope'
    );
  const url = new URL(ze_api_gateway.attribution, ZE_API_ENDPOINT());
  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
  )
    throw new Error('Remote attribution requires HTTPS');
  if (url.username || url.password)
    throw new Error('Attribution endpoints must not contain credentials');
  const token = await getToken();
  if (!token) throw new Error('Remote attribution requires Zephyr authentication');
  const idempotencyKey = createHash('sha256')
    .update(JSON.stringify([applicationUid, policy!.repositoryId, buildId]))
    .digest('hex');
  const [ok, , response] = await makeRequest<AttributionUploadResponse>(
    url,
    {
      method: 'POST',
      redirect: 'error',
      sensitiveResponse: true,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey,
      },
      credentialToken: token,
    },
    body
  );
  if (
    !ok ||
    response?.status !== 'ok' ||
    response.applicationUid !== applicationUid ||
    response.repositoryId !== policy!.repositoryId ||
    response.buildId !== buildId ||
    response.snapshotId !== snapshotId ||
    response.sourceFingerprint !== record.fingerprint ||
    typeof response.recordId !== 'string' ||
    !/^[a-zA-Z0-9._-]{1,128}$/.test(response.recordId)
  )
    throw new Error(
      'Remote attribution was not acknowledged for this repository/build; private evidence remains local'
    );
  const remote = {
    recordId: response.recordId,
    repositoryId: policy!.repositoryId,
    policyRevision: policy!.revision,
  };
  // Record delivery without rewriting the immutable source or version receipt.
  writeFileSync(
    join(gitDir, 'zephyr-attribution', `remote-${idempotencyKey}.json`),
    JSON.stringify({
      applicationUid,
      buildId,
      snapshotId,
      sourceId: record.id,
      sourceFingerprint: record.fingerprint,
      remote,
    }),
    { mode: 0o600 }
  );
  const {
    files: _files,
    sessions: _sessions,
    workspaceHuman: _human,
    ...reference
  } = summary;
  return { ...reference, storage: 'remote', remote };
}
