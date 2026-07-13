import { ZeErrors, ZephyrError } from 'zephyr-agent';
import type {
  ZephyrLegacyModuleFederationConfig,
  ZephyrModuleFederationBuildMetadata,
  ZephyrModuleFederationConfig,
} from 'zephyr-edge-contract';

function stableJson(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  switch (typeof value) {
    case 'undefined':
      return 'undefined';
    case 'string':
    case 'number':
    case 'boolean':
      return JSON.stringify(value);
    case 'bigint':
      return `bigint:${value.toString()}`;
    case 'symbol':
      return `symbol:${String(value)}`;
    case 'function':
      return `function:${String(value)}`;
    default:
      break;
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

interface Candidate<T> {
  value: T;
  fingerprint: string;
  identities: string[];
}

function mergeUnique<T>(candidates: readonly Candidate<T>[], kind: string): T[] {
  const byFingerprint = new Set<string>();
  const byIdentity = new Map<string, string>();
  const merged: T[] = [];

  for (const candidate of candidates) {
    if (byFingerprint.has(candidate.fingerprint)) {
      continue;
    }

    for (const identity of candidate.identities) {
      const existing = byIdentity.get(identity);
      if (existing && existing !== candidate.fingerprint) {
        throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
          message: `Conflicting Module Federation ${kind} for ${identity}.`,
        });
      }
    }

    byFingerprint.add(candidate.fingerprint);
    for (const identity of candidate.identities) {
      byIdentity.set(identity, candidate.fingerprint);
    }
    merged.push(candidate.value);
  }

  return merged;
}

/**
 * Retains every independent config in a stable order, collapsing exact duplicates and
 * rejecting two different configs that claim the same container name or entry path.
 */
export function mergeModuleFederationConfigs(
  configs: readonly (readonly ZephyrModuleFederationConfig[] | undefined)[]
): ZephyrModuleFederationConfig[] {
  return mergeUnique(
    configs.flatMap((configList) =>
      (configList ?? []).map((config) => ({
        value: config,
        fingerprint: stableJson(config),
        identities: [
          nonEmptyString(config.name) ? `name:${config.name}` : undefined,
          nonEmptyString(config.filename) ? `entry:${config.filename}` : undefined,
        ].filter((identity): identity is string => !!identity),
      }))
    ),
    'configuration'
  );
}

/**
 * Preserve the established single-config snapshot field only when it has an unambiguous,
 * complete legacy representation. Multi-container consumers use `mfConfigs` and must not
 * accidentally receive an arbitrary first entry.
 */
export function getLegacyModuleFederationConfig(
  configs: readonly ZephyrModuleFederationConfig[] | undefined
): ZephyrLegacyModuleFederationConfig | undefined {
  const config = configs?.length === 1 ? configs[0] : undefined;
  if (!config || !nonEmptyString(config.name) || !nonEmptyString(config.filename)) {
    return undefined;
  }

  return config as ZephyrLegacyModuleFederationConfig;
}

/**
 * Mirrors config merging for build stats so the dashboard and snapshot advertise the
 * exact same set of containers.
 */
export function mergeModuleFederationBuildMetadata(
  metadata: readonly (readonly ZephyrModuleFederationBuildMetadata[] | undefined)[]
): ZephyrModuleFederationBuildMetadata[] {
  return mergeUnique(
    metadata.flatMap((metadataList) =>
      (metadataList ?? []).map((entry) => ({
        value: entry,
        fingerprint: stableJson(entry),
        identities: [
          nonEmptyString(entry.name) ? `name:${entry.name}` : undefined,
          nonEmptyString(entry.remote) ? `entry:${entry.remote}` : undefined,
          nonEmptyString(entry.mf_manifest) ? `manifest:${entry.mf_manifest}` : undefined,
        ].filter((identity): identity is string => !!identity),
      }))
    ),
    'metadata'
  );
}
