import {
  buildAssetsMap,
  handleGlobalError,
  readDirRecursiveWithContents,
  zeBuildDashData,
  ze_log,
  type ZephyrEngine,
} from 'zephyr-agent';
import { resolve } from 'node:path';
import {
  normalizePath,
  resolveDir,
  resolveEntrypoint,
  resolveOutputDir,
} from './paths';
import type {
  NitroLike,
  NuxtLike,
  SnapshotType,
  ZephyrNuxtOptions,
} from './types';

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

function getNitroOutput(
  nitro?: NitroLike,
  nuxt?: NuxtLike
): NitroOutput | undefined {
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
  publicDir?: string
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
    prefix: 'public',
  });

  return sources;
}

async function loadAssetsFromSources(
  sources: AssetSource[]
): Promise<Record<string, Buffer>> {
  const assets: Record<string, Buffer> = {};

  for (const source of sources) {
    const files = await readDirRecursiveWithContents(source.dir);
    for (const file of files) {
      const assetPath = toAssetPath(source.prefix, file.relativePath);
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

    try {
      const zephyr_engine = await zephyrEngineDefer;
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
        publicDir
      );
      const assetSourcesLog = assetSources
        .map((source) =>
          source.prefix ? `${source.dir}=>${source.prefix}` : source.dir
        )
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

      const assets = await loadAssetsFromSources(assetSources);
      if (!Object.keys(assets).length) {
        ze_log.upload(`No build output found in ${assetSourcesLog}`);
        return;
      }

      const assetsMap = buildAssetsMap(
        assets,
        (asset) => asset,
        () => 'buffer'
      );

      await zephyr_engine.upload_assets({
        assetsMap,
        buildStats: await zeBuildDashData(zephyr_engine),
        snapshotType,
        entrypoint,
        hooks: options.hooks,
      });

      await zephyr_engine.build_finished();
      uploadCompleted = true;
      ze_log.upload('Zephyr upload complete.');
    } catch (error) {
      handleGlobalError(error);
    } finally {
      uploadInProgress = false;
    }
  };
}
