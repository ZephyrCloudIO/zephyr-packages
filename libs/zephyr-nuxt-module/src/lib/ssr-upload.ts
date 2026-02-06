import {
  buildAssetsMap,
  handleGlobalError,
  readDirRecursiveWithContents,
  zeBuildDashData,
  ze_log,
  type ZephyrEngine,
} from 'zephyr-agent';
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

function getNitroOutput(nitro?: NitroLike, nuxt?: NuxtLike): NitroOutput | undefined {
  return nitro?.options?.output ?? nuxt?.options?.nitro?.output;
}

export function createUploadRunner({
  nuxt,
  options,
  zephyrEngineDefer,
  initEngine,
}: UploadContext) {
  let uploadCompleted = false;

  return async (nitro?: NitroLike) => {
    if (uploadCompleted) return;
    uploadCompleted = true;
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

      const assetsRoot = snapshotType === 'csr' && publicDir ? publicDir : outputDir;
      ze_log.upload(
        `Zephyr upload starting. snapshotType=${snapshotType} output=${assetsRoot}`
      );
      if (entrypoint) {
        ze_log.upload(`Zephyr entrypoint: ${entrypoint}`);
      }

      zephyr_engine.env.ssr = snapshotType === 'ssr';
      zephyr_engine.buildProperties.output = assetsRoot;

      const baseHref = nuxt.options.app?.baseURL;
      if (baseHref) {
        zephyr_engine.buildProperties.baseHref = baseHref;
      }

      const files = await readDirRecursiveWithContents(assetsRoot);
      if (!files.length) {
        ze_log.upload(`No build output found in ${assetsRoot}`);
        return;
      }

      const assets: Record<string, Buffer> = files.reduce(
        (memo, file) => {
          const relativePath = normalizePath(file.relativePath);
          memo[relativePath] = file.content;
          return memo;
        },
        {} as Record<string, Buffer>
      );

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
      ze_log.upload('Zephyr upload complete.');
    } catch (error) {
      handleGlobalError(error);
    }
  };
}
