import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import type { MetroFederationConfig } from './zephyr-metro-command-wrapper';
import { ZephyrMetroPlugin } from './zephyr-metro-plugin';
import { load_static_entries } from './internal/load-static-entries';
import { createMetroAssetsMap } from './internal/create-metro-assets-map';

export interface PublishPrebuiltMetroOptions {
  context: string;
  artifactDirectory: string;
  mfConfig: NonNullable<MetroFederationConfig>;
  targets: readonly ('ios' | 'android')[];
}
export interface MetroPublicationResult {
  target: 'ios' | 'android';
  applicationUid: string;
  buildId: string;
  snapshotId: string;
  versionUrl: string;
}
export class PrebuiltMetroPublishError extends Error {
  readonly target: 'ios' | 'android';
  readonly completed: readonly MetroPublicationResult[];
  constructor(
    message: string,
    target: 'ios' | 'android',
    completed: readonly MetroPublicationResult[],
    cause: unknown
  ) {
    super(message, { cause });
    this.name = 'PrebuiltMetroPublishError';
    this.target = target;
    this.completed = completed;
  }
}

interface JsonRecord {
  [key: string]: unknown;
  metaData?: unknown;
  remoteEntry?: unknown;
  buildInfo?: unknown;
  name?: unknown;
  hash?: unknown;
  path?: unknown;
  exposes?: unknown;
  shared?: unknown;
  assets?: unknown;
  js?: unknown;
  async?: unknown;
  sync?: unknown;
  remotes?: unknown;
  dependencies?: unknown;
  sources?: unknown;
  mappings?: unknown;
}
const digest = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const isRecord = (value: unknown): value is JsonRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function declaredArtifacts(manifest: JsonRecord): Record<string, string> {
  const metadata = manifest.metaData;
  if (
    !isRecord(metadata) ||
    !isRecord(metadata.remoteEntry) ||
    !isRecord(metadata.buildInfo)
  )
    throw new Error('Malformed MF manifest metadata');
  const entry = metadata.remoteEntry;
  const buildInfo = metadata.buildInfo;
  if (
    typeof entry.name !== 'string' ||
    typeof buildInfo.hash !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(buildInfo.hash)
  )
    throw new Error('MF manifest entry/hash is malformed');
  const paths: Record<string, string> = {};
  paths[
    String(entry.path ? `${String(entry.path).replace(/^\/+|\/+$/g, '')}/` : '') +
      entry.name
  ] = buildInfo.hash;
  if (!Array.isArray(manifest.exposes) || !Array.isArray(manifest.shared))
    throw new Error('MF manifest exposes/shared must be arrays');
  for (const expose of manifest.exposes) {
    if (
      !isRecord(expose) ||
      typeof expose.name !== 'string' ||
      typeof expose.hash !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(expose.hash)
    )
      throw new Error('Malformed MF expose artifact');
    const assets =
      isRecord(expose.assets) && isRecord(expose.assets.js) ? expose.assets.js : {};
    if (Array.isArray(assets.async) && assets.async.length)
      throw new Error(
        `Exposed module ${expose.name} has unverifiable async executable assets`
      );
    paths[`exposed/${expose.name}.bundle`] = expose.hash;
  }
  for (const shared of manifest.shared) {
    if (!isRecord(shared) || typeof shared.name !== 'string')
      throw new Error('Malformed MF shared artifact');
    const assets =
      isRecord(shared.assets) && isRecord(shared.assets.js) ? shared.assets.js : {};
    if (Array.isArray(assets.async) && assets.async.length)
      throw new Error(
        `Shared module ${shared.name} has unverifiable async executable assets`
      );
    const sync = Array.isArray(assets.sync) ? assets.sync : [];
    if (sync.length === 0) continue;
    if (
      sync.length !== 1 ||
      typeof shared.hash !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(shared.hash)
    )
      throw new Error(
        `Shared module ${shared.name} is not represented by one verifiable artifact`
      );
    const file = String(sync[0])
      .replace(/^\.\//, '')
      .replace(/\.\w+$/, '.bundle');
    paths[file] = shared.hash;
  }
  return paths;
}

const assetText = (source: string | Uint8Array) =>
  typeof source === 'string'
    ? source
    : Buffer.from(source.buffer, source.byteOffset, source.byteLength).toString('utf8');
async function readAndValidate(options: PublishPrebuiltMetroOptions) {
  if (!options.targets.length)
    throw new TypeError('At least one publication target is required');
  const seen = new Set<string>();
  for (const target of options.targets) {
    if (target !== 'ios' && target !== 'android')
      throw new TypeError(`Unsupported publication target: ${String(target)}`);
    if (seen.has(target)) throw new TypeError(`Duplicate publication target: ${target}`);
    seen.add(target);
  }
  const loaded = await load_static_entries({
    root: options.context,
    outDir: options.artifactDirectory,
  });
  if (!loaded.length)
    throw new Error(
      `Prebuilt artifact directory is missing or empty: ${options.artifactDirectory}`
    );
  const assets: Record<string, (typeof loaded)[number]> = {};
  for (const asset of loaded) {
    if (!asset.fileName || assets[asset.fileName])
      throw new Error(`Duplicate or empty Metro artifact path: ${asset.fileName}`);
    assets[asset.fileName] = asset;
  }
  const manifestAsset = assets['mf-manifest.json'];
  if (!manifestAsset) throw new Error('Prebuilt output is missing mf-manifest.json');
  let manifest: JsonRecord;
  try {
    manifest = JSON.parse(assetText(manifestAsset.source)) as JsonRecord;
  } catch (cause) {
    throw new Error('Prebuilt mf-manifest.json is malformed', { cause });
  }
  const metadata = manifest.metaData;
  if (
    !isRecord(metadata) ||
    !isRecord(metadata.remoteEntry) ||
    !isRecord(metadata.buildInfo)
  )
    throw new Error('MF manifest is missing required metadata');
  if (manifest.name !== options.mfConfig.name || metadata.name !== options.mfConfig.name)
    throw new Error('MF manifest name does not match mfConfig.name');
  if (metadata.remoteEntry.name !== options.mfConfig.filename)
    throw new Error('MF manifest entry does not match mfConfig.filename');
  const declaredExposeNames = Array.isArray(manifest.exposes)
    ? manifest.exposes
        .filter(isRecord)
        .map((item) => `./${String(item.name)}`)
        .sort()
    : [];
  const configuredExposeNames = Object.keys(options.mfConfig.exposes ?? {}).sort();
  if (JSON.stringify(declaredExposeNames) !== JSON.stringify(configuredExposeNames))
    throw new Error('MF manifest exposes do not match mfConfig.exposes');
  const remotes = options.mfConfig.remotes;
  if (options.targets.length > 1 && remotes && Object.keys(remotes).length)
    throw new Error(
      'Prebuilt multi-target publication does not support configured remotes'
    );
  if (
    options.targets.length > 1 &&
    Array.isArray(manifest.remotes) &&
    manifest.remotes.length
  )
    throw new Error(
      'Prebuilt multi-target publication does not support MF manifest remotes'
    );
  const zephyrManifest = assets['zephyr-manifest.json'];
  if (options.targets.length > 1 && zephyrManifest) {
    const parsed = JSON.parse(
      typeof zephyrManifest.source === 'string'
        ? zephyrManifest.source
        : Buffer.from(zephyrManifest.source).toString('utf8')
    ) as unknown;
    if (
      isRecord(parsed) &&
      isRecord(parsed.dependencies) &&
      Object.keys(parsed.dependencies).length
    )
      throw new Error(
        'Prebuilt multi-target publication does not support Zephyr manifest dependencies'
      );
  }
  const declared = declaredArtifacts(manifest);
  const root = resolve(options.context, options.artifactDirectory);
  for (const [path, expectedHash] of Object.entries(declared)) {
    const normalized = path.split('/').join(sep);
    if (!existsSync(resolve(root, normalized)))
      throw new Error(`MF manifest declares missing executable: ${path}`);
    const asset = assets[path];
    if (asset) {
      const bytes =
        typeof asset.source === 'string'
          ? Buffer.from(asset.source)
          : Buffer.from(
              asset.source.buffer,
              asset.source.byteOffset,
              asset.source.byteLength
            );
      if (digest(bytes) !== expectedHash.toLowerCase())
        throw new Error(`Raw executable hash differs from MF manifest: ${path}`);
    }
  }
  for (const asset of loaded) {
    if (asset.fileName.endsWith('.map')) {
      const source =
        typeof asset.source === 'string'
          ? asset.source
          : Buffer.from(asset.source).toString('utf8');
      let map: unknown;
      try {
        map = JSON.parse(source);
      } catch (cause) {
        throw new Error(`Malformed source map: ${asset.fileName}`, { cause });
      }
      if (
        !isRecord(map) ||
        !Array.isArray(map.sources) ||
        typeof map.mappings !== 'string'
      )
        throw new Error(`Malformed source map: ${asset.fileName}`);
    }
  }
  if (!Object.keys(assets).some((path) => path.endsWith('.bundle')))
    throw new Error('Prebuilt output contains no executable bundles');
  const map = Object.freeze(createMetroAssetsMap(assets));
  return { map };
}

export async function publishPrebuiltMetroArtifacts(
  options: PublishPrebuiltMetroOptions
): Promise<readonly MetroPublicationResult[]> {
  const { map } = await readAndValidate(options);
  const completed: MetroPublicationResult[] = [];
  for (const target of options.targets) {
    const config = {
      ...options.mfConfig,
      remotes: options.mfConfig.remotes ? { ...options.mfConfig.remotes } : undefined,
    };
    const plugin = new ZephyrMetroPlugin({
      platform: target,
      mode: 'production',
      context: options.context,
      outDir: options.artifactDirectory,
      mfConfig: config,
    });
    try {
      await plugin.beforeBuild();
      const result = await plugin.publishAssetsMap(map);
      completed.push(result);
    } catch (cause) {
      if (plugin.zephyr_engine?.hasActiveBuild !== false)
        plugin.zephyr_engine?.build_failed();
      throw new PrebuiltMetroPublishError(
        `Prebuilt Metro publication failed for ${target}`,
        target,
        completed,
        cause
      );
    }
  }
  return completed;
}
