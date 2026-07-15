import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ZeErrors, ZephyrError } from 'zephyr-agent';
import type {
  ZephyrBuildTarget,
  ZephyrLegacyModuleFederationConfig,
  ZephyrModuleFederationBuildMetadata,
  ZephyrModuleFederationConfig,
} from 'zephyr-edge-contract';

/**
 * Serializable publication metadata written by a TAP SDK or compatible bundler.
 *
 * `mfConfigs` is retained on the snapshot and `federation` is retained in build
 * statistics. The legacy singular field is only populated when the sidecar declares one
 * unambiguous container.
 */
export interface CliPublicationMetadata {
  mfConfig?: ZephyrLegacyModuleFederationConfig;
  mfConfigs?: ZephyrModuleFederationConfig[];
  federation?: ZephyrModuleFederationBuildMetadata[];
}

export interface LoadPublicationMetadataOptions {
  /** Path supplied through `--metadata`, resolved from the CLI working directory. */
  metadataPath?: string;
  cwd: string;
  target?: ZephyrBuildTarget;
}

type JsonRecord = Record<string, unknown>;

const TOP_LEVEL_KEYS = new Set(['mfConfig', 'mfConfigs', 'federation']);
const FEDERATION_KEYS = new Set([
  'name',
  'remote',
  'mf_manifest',
  'library_type',
  'exposes',
  'shared',
]);
const UNSAFE_JSON_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function metadataError(
  message: string,
  cause?: unknown
): ZephyrError<'ERR_DEPLOY_LOCAL_BUILD'> {
  return new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
    message: `Invalid publication metadata sidecar: ${message}`,
    ...(cause === undefined ? {} : { cause }),
  });
}

function isJsonRecord(value: unknown): value is JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertJsonValue(value: unknown, path: string): void {
  if (value === null) return;

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return;
    case 'number':
      if (Number.isFinite(value)) return;
      throw metadataError(`${path} must contain finite JSON numbers.`);
    case 'object':
      if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
          assertJsonValue(value[index], `${path}[${index}]`);
        }
        return;
      }
      if (!isJsonRecord(value)) {
        throw metadataError(`${path} must be a JSON object, array, or primitive.`);
      }
      for (const [key, nestedValue] of Object.entries(value)) {
        if (UNSAFE_JSON_KEYS.has(key)) {
          throw metadataError(`${path}.${key} is not allowed.`);
        }
        assertJsonValue(nestedValue, `${path}.${key}`);
      }
      return;
    default:
      throw metadataError(`${path} must contain JSON-serializable values.`);
  }
}

function assertOnlyKeys(
  record: JsonRecord,
  allowed: ReadonlySet<string>,
  path: string
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      throw metadataError(`${path} contains unsupported field ${JSON.stringify(key)}.`);
    }
  }
}

function hasOwn(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function requiredNonEmptyString(record: JsonRecord, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw metadataError(`${path}.${key} must be a non-empty string.`);
  }
  return value;
}

function optionalString(
  record: JsonRecord,
  key: string,
  path: string
): string | undefined {
  if (!hasOwn(record, key)) return undefined;
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw metadataError(`${path}.${key} must be a non-empty string when provided.`);
  }
  return value;
}

function assertRecordOrArray(value: unknown, path: string): void {
  if (!isJsonRecord(value) && !Array.isArray(value)) {
    throw metadataError(`${path} must be an object or array when provided.`);
  }
}

function isRuntimePluginEntry(value: unknown): boolean {
  return (
    typeof value === 'string' ||
    (Array.isArray(value) &&
      value.length === 2 &&
      typeof value[0] === 'string' &&
      isJsonRecord(value[1]))
  );
}

function assertLegacyConfigShape(
  value: unknown,
  path: string
): ZephyrLegacyModuleFederationConfig {
  if (!isJsonRecord(value)) {
    throw metadataError(`${path} must be an object.`);
  }
  const record = value;
  assertJsonValue(record, path);
  requiredNonEmptyString(record, 'name', path);
  requiredNonEmptyString(record, 'filename', path);

  for (const key of ['exposes', 'remotes', 'shared'] as const) {
    if (hasOwn(record, key) && !isJsonRecord(record[key])) {
      throw metadataError(`${path}.${key} must be an object when provided.`);
    }
  }

  if (hasOwn(record, 'runtimePlugins')) {
    const runtimePlugins = record['runtimePlugins'];
    if (!Array.isArray(runtimePlugins) || !runtimePlugins.every(isRuntimePluginEntry)) {
      throw metadataError(
        `${path}.runtimePlugins must contain plugin paths or [plugin path, options] tuples.`
      );
    }
  }

  if (hasOwn(record, 'manifest')) {
    const manifest = record['manifest'];
    if (typeof manifest !== 'boolean' && !isJsonRecord(manifest)) {
      throw metadataError(`${path}.manifest must be a boolean or object when provided.`);
    }
    if (isJsonRecord(manifest)) {
      assertOnlyKeys(manifest, new Set(['fileName', 'filePath']), `${path}.manifest`);
      optionalString(manifest, 'fileName', `${path}.manifest`);
      optionalString(manifest, 'filePath', `${path}.manifest`);
    }
  }

  return { ...record } as unknown as ZephyrLegacyModuleFederationConfig;
}

function assertMfConfigsShape(value: unknown): ZephyrModuleFederationConfig[] {
  if (!Array.isArray(value)) {
    throw metadataError('mfConfigs must be an array.');
  }

  const names = new Set<string>();
  const filenames = new Set<string>();
  return value.map((config, index) => {
    const path = `mfConfigs[${index}]`;
    if (!isJsonRecord(config)) {
      throw metadataError(`${path} must be an object.`);
    }
    assertJsonValue(config, path);
    const name = requiredNonEmptyString(config, 'name', path);
    const filename = requiredNonEmptyString(config, 'filename', path);
    if (names.has(name)) {
      throw metadataError(
        `mfConfigs contains more than one container named ${JSON.stringify(name)}.`
      );
    }
    if (filenames.has(filename)) {
      throw metadataError(
        `mfConfigs contains more than one container with entry ${JSON.stringify(filename)}.`
      );
    }
    names.add(name);
    filenames.add(filename);
    return { ...config } as ZephyrModuleFederationConfig;
  });
}

function assertFederationShape(value: unknown): ZephyrModuleFederationBuildMetadata[] {
  if (!Array.isArray(value)) {
    throw metadataError('federation must be an array.');
  }

  const names = new Set<string>();
  const remotes = new Set<string>();
  return value.map((entry, index) => {
    const path = `federation[${index}]`;
    if (!isJsonRecord(entry)) {
      throw metadataError(`${path} must be an object.`);
    }
    assertOnlyKeys(entry, FEDERATION_KEYS, path);
    assertJsonValue(entry, path);
    const name = requiredNonEmptyString(entry, 'name', path);
    const remote = requiredNonEmptyString(entry, 'remote', path);
    optionalString(entry, 'mf_manifest', path);
    optionalString(entry, 'library_type', path);
    for (const key of ['exposes', 'shared'] as const) {
      if (hasOwn(entry, key)) assertRecordOrArray(entry[key], `${path}.${key}`);
    }
    if (names.has(name)) {
      throw metadataError(
        `federation contains more than one container named ${JSON.stringify(name)}.`
      );
    }
    if (remotes.has(remote)) {
      throw metadataError(
        `federation contains more than one container with entry ${JSON.stringify(remote)}.`
      );
    }
    names.add(name);
    remotes.add(remote);
    return { ...entry } as ZephyrModuleFederationBuildMetadata;
  });
}

function assertTapMetadataContract(metadata: CliPublicationMetadata): void {
  const { mfConfig, mfConfigs, federation } = metadata;
  if (!mfConfigs || mfConfigs.length === 0) {
    throw metadataError('tap-app metadata must include a non-empty mfConfigs array.');
  }
  if (!federation || federation.length === 0) {
    throw metadataError('tap-app metadata must include a non-empty federation array.');
  }
  if (mfConfigs.length !== federation.length) {
    throw metadataError(
      'tap-app metadata must include the same number of mfConfigs and federation entries.'
    );
  }

  const federationByName = new Map(
    federation.map((entry) => [entry.name as string, entry] as const)
  );
  for (const config of mfConfigs) {
    const federationEntry = federationByName.get(config.name as string);
    if (!federationEntry || federationEntry.remote !== config.filename) {
      throw metadataError(
        `tap-app metadata must pair mfConfigs entry ${JSON.stringify(config.name)} with a federation entry using remote ${JSON.stringify(config.filename)}.`
      );
    }
  }

  if (mfConfig) {
    if (
      mfConfigs.length !== 1 ||
      mfConfig.name !== mfConfigs[0]?.name ||
      mfConfig.filename !== mfConfigs[0]?.filename
    ) {
      throw metadataError(
        'mfConfig is allowed for tap-app metadata only when it is the same single container in mfConfigs.'
      );
    }
  }
}

/**
 * Validates parsed sidecar JSON. TAP metadata intentionally has a stricter contract:
 * every snapshot config must have one matching build-stat entry. This prevents a CLI
 * upload from dropping an SDK-produced target or choosing an arbitrary first container.
 */
export function parsePublicationMetadata(
  value: unknown,
  target?: ZephyrBuildTarget
): CliPublicationMetadata {
  if (!isJsonRecord(value)) {
    throw metadataError('the top-level value must be an object.');
  }
  assertOnlyKeys(value, TOP_LEVEL_KEYS, 'metadata');
  assertJsonValue(value, 'metadata');

  const explicitMfConfig = hasOwn(value, 'mfConfig')
    ? assertLegacyConfigShape(value['mfConfig'], 'mfConfig')
    : undefined;
  const mfConfigs = hasOwn(value, 'mfConfigs')
    ? assertMfConfigsShape(value['mfConfigs'])
    : undefined;
  const federation = hasOwn(value, 'federation')
    ? assertFederationShape(value['federation'])
    : undefined;

  // A singular snapshot value is safe only when the array itself has one container. Do
  // not manufacture it from mfConfigs[0] for a multi-target package.
  const mfConfig =
    explicitMfConfig ??
    (mfConfigs?.length === 1
      ? (mfConfigs[0] as ZephyrLegacyModuleFederationConfig)
      : undefined);
  const metadata: CliPublicationMetadata = {
    ...(mfConfig ? { mfConfig } : {}),
    ...(mfConfigs ? { mfConfigs } : {}),
    ...(federation ? { federation } : {}),
  };

  if (target === 'tap-app') {
    assertTapMetadataContract(metadata);
  }

  return metadata;
}

/**
 * Reads a publication metadata sidecar. TAP uploads require one so the CLI cannot
 * silently publish a package while omitting its independently addressable containers.
 */
export async function loadPublicationMetadata(
  options: LoadPublicationMetadataOptions
): Promise<CliPublicationMetadata | undefined> {
  const { metadataPath, cwd, target } = options;
  if (!metadataPath?.trim()) {
    if (target === 'tap-app') {
      throw metadataError('tap-app publication requires --metadata <path>.');
    }
    return undefined;
  }

  const metadataFile = resolve(cwd, metadataPath);
  let source: string;
  try {
    source = await readFile(metadataFile, 'utf8');
  } catch (cause) {
    throw metadataError(`could not read ${metadataFile}.`, cause);
  }

  let parsed: unknown;
  try {
    // UTF-8 JSON sidecars created on Windows occasionally include a BOM.
    parsed = JSON.parse(source.replace(/^\uFEFF/, '')) as unknown;
  } catch (cause) {
    throw metadataError(`could not parse JSON from ${metadataFile}.`, cause);
  }

  return parsePublicationMetadata(parsed, target);
}
