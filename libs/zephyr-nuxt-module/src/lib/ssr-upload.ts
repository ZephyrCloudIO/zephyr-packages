import {
  buildAssetsMap,
  handleGlobalError,
  readDirRecursiveWithContents,
  ZeErrors,
  ZephyrError,
  zeBuildDashData,
  ze_log,
  type ZephyrEngine,
} from 'zephyr-agent';
import type { ZephyrLegacyModuleFederationConfig } from 'zephyr-edge-contract';
import { resolve } from 'node:path';
import { normalizePath, resolveDir, resolveEntrypoint, resolveOutputDir } from './paths';
import type { NitroLike, NuxtLike, SnapshotType, ZephyrNuxtOptions } from './types';

interface UploadContext {
  nuxt: NuxtLike;
  options: ZephyrNuxtOptions;
  zephyrEngineDefer: Promise<ZephyrEngine>;
  initEngine: () => void;
}

interface NitroOutput {
  dir?: string;
  publicDir?: string;
}

export interface AssetSource {
  dir: string;
  prefix?: string;
}

/**
 * Keep the legacy snapshot field only for its unambiguous, complete shape. The complete
 * `mfConfigs` array remains the source of truth for multi-container publications.
 */
function getLegacyModuleFederationConfig(
  mfConfigs: ZephyrNuxtOptions['mfConfigs']
): ZephyrLegacyModuleFederationConfig | undefined {
  const config = mfConfigs?.length === 1 ? mfConfigs[0] : undefined;
  if (!config || !nonEmptyString(config.name) || !nonEmptyString(config.filename)) {
    return undefined;
  }

  return config as ZephyrLegacyModuleFederationConfig;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim();
}

/**
 * TAP descriptors identify every remote by its container name and entry filename. The
 * adapter does not interpret that SDK data, but must reject an incomplete pairing rather
 * than upload a package whose snapshot and dashboard disagree.
 */
function assertTapModuleFederationMetadata(
  target: ZephyrNuxtOptions['target'],
  mfConfigs: ZephyrNuxtOptions['mfConfigs'],
  federation: ZephyrNuxtOptions['federation']
): void {
  if (target !== 'tap-app') {
    return;
  }

  if (!mfConfigs?.length || !federation?.length) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message:
        'Nuxt TAP publication requires non-empty mfConfigs and federation metadata arrays.',
    });
  }
  if (mfConfigs.length !== federation.length) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message:
        'Nuxt TAP mfConfigs and federation metadata must contain the same number of entries.',
    });
  }

  const federationByName = new Map<
    string,
    NonNullable<ZephyrNuxtOptions['federation']>[number]
  >();
  const remotes = new Set<string>();
  for (const metadata of federation) {
    if (!nonEmptyString(metadata.name) || !nonEmptyString(metadata.remote)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message:
          'Nuxt TAP federation metadata requires a non-empty name and remote for every container.',
      });
    }
    if (federationByName.has(metadata.name) || remotes.has(metadata.remote)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message:
          'Nuxt TAP federation metadata entries must not duplicate names or remotes.',
      });
    }
    federationByName.set(metadata.name, metadata);
    remotes.add(metadata.remote);
  }

  const names = new Set<string>();
  const filenames = new Set<string>();
  for (const config of mfConfigs) {
    if (!nonEmptyString(config.name) || !nonEmptyString(config.filename)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message:
          'Nuxt TAP mfConfigs requires a non-empty name and filename for every container.',
      });
    }
    if (names.has(config.name) || filenames.has(config.filename)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message: 'Nuxt TAP mfConfigs entries must not duplicate names or filenames.',
      });
    }
    if (federationByName.get(config.name)?.remote !== config.filename) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message: `Nuxt TAP federation metadata has no matching name and remote for mfConfigs entry "${config.name}" at "${config.filename}".`,
      });
    }
    names.add(config.name);
    filenames.add(config.filename);
  }
}

function getNitroOutput(nitro?: NitroLike, nuxt?: NuxtLike): NitroOutput | undefined {
  return nitro?.options?.output ?? nuxt?.options?.nitro?.output;
}

function normalizeDirPath(dir: string): string {
  return normalizePath(resolve(dir)).replace(/\/+$/, '');
}

function isSubPath(parent: string, child: string): boolean {
  const normalizedParent = normalizeDirPath(parent);
  const normalizedChild = normalizeDirPath(child);
  return (
    normalizedChild === normalizedParent ||
    normalizedChild.startsWith(`${normalizedParent}/`)
  );
}

function toAssetPath(prefix: string | undefined, relativePath: string): string {
  const normalizedPath = normalizePath(relativePath);
  const prefixedPath = prefix ? `${prefix}/${normalizedPath}` : normalizedPath;
  return prefixedPath.replace(/^\/+/, '');
}

export function resolveAssetSources(
  snapshotType: SnapshotType,
  outputDir: string,
  publicDir?: string,
  target?: ZephyrNuxtOptions['target']
): AssetSource[] {
  if (snapshotType === 'csr') {
    return [{ dir: publicDir ?? outputDir }];
  }

  const sources: AssetSource[] = [{ dir: outputDir }];
  if (!publicDir) {
    return sources;
  }

  if (isSubPath(outputDir, publicDir)) {
    return sources;
  }

  sources.push({
    dir: publicDir,
    // TAP locks package-relative paths. Its SDK may put descriptor, lock, and target
    // artifacts directly in Nitro's separate public directory, so adding Nuxt's
    // conventional `public/` namespace would invalidate that lock.
    ...(target === 'tap-app' ? {} : { prefix: 'public' }),
  });

  return sources;
}

async function loadAssetsFromSources(
  sources: AssetSource[],
  target: ZephyrNuxtOptions['target']
): Promise<Record<string, Buffer>> {
  const assets: Record<string, Buffer> = {};

  for (const source of sources) {
    const files = await readDirRecursiveWithContents(source.dir, {
      includeIgnoredPaths: target === 'tap-app',
      failOnError: target === 'tap-app',
    });
    for (const file of files) {
      const assetPath = toAssetPath(source.prefix, file.relativePath);
      if (Object.prototype.hasOwnProperty.call(assets, assetPath)) {
        throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
          message:
            `Nuxt emitted conflicting assets for snapshot path "${assetPath}" from ` +
            `"${source.dir}". Configure one canonical TAP package output root.`,
        });
      }
      assets[assetPath] = file.content;
    }
  }

  return assets;
}

export function createUploadRunner({
  nuxt,
  options,
  zephyrEngineDefer,
  initEngine,
}: UploadContext) {
  let uploadCompleted = false;
  let uploadInProgress = false;

  return async (nitro?: NitroLike) => {
    if (uploadCompleted || uploadInProgress) return;
    uploadInProgress = true;
    initEngine();
    let zephyr_engine: ZephyrEngine | undefined;
    let buildInProgress = false;

    try {
      zephyr_engine = await zephyrEngineDefer;
      // ZephyrEngine.create starts generation zero before resolving this deferred.
      // The call is idempotent for that first attempt and allocates fresh state after a
      // failed close-hook attempt is retried.
      buildInProgress = true;
      await zephyr_engine.start_new_build();
      ze_log.upload('Nuxt build done. Preparing Zephyr upload...');

      const nitroOutput = getNitroOutput(nitro, nuxt);
      const outputDir = resolveOutputDir(
        nuxt.options.rootDir,
        options.outputDir,
        nitroOutput?.dir
      );

      const publicDir = options.outputDir
        ? undefined
        : resolveDir(nuxt.options.rootDir, nitroOutput?.publicDir);

      let entrypoint = await resolveEntrypoint(outputDir, options.entrypoint);
      const snapshotType: SnapshotType =
        options.snapshotType ?? (entrypoint ? 'ssr' : 'csr');

      if (snapshotType === 'ssr' && !entrypoint) {
        ze_log.upload('SSR snapshot requested but no entrypoint found.');
        return;
      }

      if (snapshotType === 'csr') {
        entrypoint = undefined;
      }

      const assetSources = resolveAssetSources(
        snapshotType,
        outputDir,
        publicDir,
        options.target
      );
      const assetSourcesLog = assetSources
        .map((source) => (source.prefix ? `${source.dir}=>${source.prefix}` : source.dir))
        .join(', ');
      ze_log.upload(
        `Zephyr upload starting. snapshotType=${snapshotType} output=${assetSourcesLog}`
      );
      if (entrypoint) {
        ze_log.upload(`Zephyr entrypoint: ${entrypoint}`);
      }

      zephyr_engine.env.ssr = snapshotType === 'ssr';
      zephyr_engine.buildProperties.output = outputDir;

      const baseHref = nuxt.options.app?.baseURL;
      if (baseHref) {
        zephyr_engine.buildProperties.baseHref = baseHref;
      }

      const assets = await loadAssetsFromSources(assetSources, options.target);
      if (!Object.keys(assets).length) {
        ze_log.upload(`No build output found in ${assetSourcesLog}`);
        return;
      }

      const assetsMap = buildAssetsMap(
        assets,
        (asset) => asset,
        () => 'buffer'
      );

      assertTapModuleFederationMetadata(
        options.target,
        options.mfConfigs,
        options.federation
      );
      const buildStats = await zeBuildDashData(zephyr_engine);
      const mfConfig = getLegacyModuleFederationConfig(options.mfConfigs);
      await zephyr_engine.upload_assets({
        assetsMap,
        buildStats:
          options.federation === undefined
            ? buildStats
            : { ...buildStats, federation: options.federation },
        ...(mfConfig === undefined ? {} : { mfConfig }),
        ...(options.mfConfigs === undefined ? {} : { mfConfigs: options.mfConfigs }),
        snapshotType,
        entrypoint,
        hooks: options.hooks,
      });

      buildInProgress = false;
      await zephyr_engine.build_finished();
      uploadCompleted = true;
      ze_log.upload('Zephyr upload complete.');
    } catch (error) {
      handleGlobalError(error);
    } finally {
      if (buildInProgress && zephyr_engine?.hasActiveBuild !== false) {
        zephyr_engine?.build_failed();
      }
      uploadInProgress = false;
    }
  };
}
