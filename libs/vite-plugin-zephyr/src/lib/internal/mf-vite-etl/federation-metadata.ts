import { resolveMfManifestPath, ZeErrors, ZephyrError } from 'zephyr-agent';
import type {
  ModuleFederationManifestOptions,
  ModuleFederationOptions,
  ModuleFederationRuntimePlugin,
} from './ensure_runtime_plugin';

/** The established single-container snapshot shape. */
export interface ViteLegacyModuleFederationConfig {
  name: string;
  filename: string;
  exposes?: Record<string, string>;
  remotes?: Record<string, string>;
  shared?: Record<string, unknown>;
  runtimePlugins?: ModuleFederationRuntimePlugin[];
  manifest?: boolean | ModuleFederationManifestOptions;
}

/** Serializable dashboard metadata for one independently addressable Vite container. */
export interface ViteModuleFederationBuildMetadata {
  name?: string;
  remote?: string;
  mf_manifest?: string;
  library_type?: string;
  exposes?: ModuleFederationOptions['exposes'];
  shared?: ModuleFederationOptions['shared'];
}

export interface ViteModuleFederationPublicationMetadata {
  mfConfig?: ViteLegacyModuleFederationConfig;
  mfConfigs?: ModuleFederationOptions[];
  federation?: ViteModuleFederationBuildMetadata[];
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function serializeConfig(config: ModuleFederationOptions): ModuleFederationOptions {
  try {
    const serialized = JSON.stringify(config);
    if (!serialized) {
      throw new Error('configuration did not serialize to JSON');
    }
    return JSON.parse(serialized) as ModuleFederationOptions;
  } catch {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message:
        'Vite Module Federation configuration must be JSON-serializable before Zephyr can publish it.',
    });
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'undefined';
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

/**
 * A Vite MF container is publicly identified by its `name` and emitted entry `filename`.
 * Two configs that share either identity describe the same container.
 */
export function getConfigIdentities(config: ModuleFederationOptions): string[] {
  return [
    nonEmptyString(config.name) ? `name:${config.name}` : undefined,
    nonEmptyString(config.filename) ? `entry:${config.filename}` : undefined,
  ].filter((identity): identity is string => !!identity);
}

/**
 * Snapshot metadata must include every configured Vite container. Exact duplicate plugin
 * wrappers are harmless, while divergent configs with one public identity are ambiguous
 * and must fail before a snapshot chooses one arbitrarily.
 */
export function mergeViteModuleFederationConfigs(
  configLists: readonly (readonly ModuleFederationOptions[] | undefined)[]
): ModuleFederationOptions[] {
  const byFingerprint = new Set<string>();
  const byIdentity = new Map<string, string>();
  const merged: ModuleFederationOptions[] = [];

  for (const sourceConfig of configLists.flatMap((configs) => configs ?? [])) {
    const config = serializeConfig(sourceConfig);
    const fingerprint = stableJson(config);
    if (byFingerprint.has(fingerprint)) {
      continue;
    }

    for (const identity of getConfigIdentities(config)) {
      const existing = byIdentity.get(identity);
      if (existing && existing !== fingerprint) {
        throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
          message: `Conflicting Vite Module Federation configuration for ${identity}.`,
        });
      }
    }

    byFingerprint.add(fingerprint);
    for (const identity of getConfigIdentities(config)) {
      byIdentity.set(identity, fingerprint);
    }
    merged.push(config);
  }

  return merged;
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !Object.values(value).every((entry) => typeof entry === 'string')
  ) {
    return undefined;
  }
  return value as Record<string, string>;
}

function getLegacyConfig(
  configs: readonly ModuleFederationOptions[]
): ViteLegacyModuleFederationConfig | undefined {
  const config = configs.length === 1 ? configs[0] : undefined;
  const name = nonEmptyString(config?.name);
  const filename = nonEmptyString(config?.filename);
  if (!config || !name || !filename) {
    return undefined;
  }
  const remotes = stringRecord(config.remotes);

  return {
    name,
    filename,
    ...(config.exposes ? { exposes: config.exposes } : {}),
    ...(remotes ? { remotes } : {}),
    ...(config.shared ? { shared: config.shared } : {}),
    ...(config.runtimePlugins ? { runtimePlugins: config.runtimePlugins } : {}),
    ...(config.manifest !== undefined ? { manifest: config.manifest } : {}),
  };
}

function libraryType(library: ModuleFederationOptions['library']): string | undefined {
  if (typeof library === 'string') {
    return library;
  }
  if (library && !Array.isArray(library)) {
    return library.type;
  }
  return undefined;
}

export function createViteModuleFederationPublicationMetadata(
  configs: readonly ModuleFederationOptions[]
): ViteModuleFederationPublicationMetadata {
  const mfConfigs = mergeViteModuleFederationConfigs([configs]);
  const mfConfig = getLegacyConfig(mfConfigs);
  const federation = mfConfigs.map((config) => ({
    name: config.name,
    remote: config.filename,
    mf_manifest: resolveMfManifestPath(config.manifest),
    library_type: libraryType(config.library),
    exposes: config.exposes,
    shared: config.shared,
  }));

  return {
    ...(mfConfigs.length > 0 ? { mfConfigs } : {}),
    ...(mfConfig ? { mfConfig } : {}),
    ...(federation.length > 0 ? { federation } : {}),
  };
}
