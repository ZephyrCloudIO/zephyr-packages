import { defineNuxtModule } from '@nuxt/kit';
import { access } from 'node:fs/promises';
import { isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import {
  buildAssetsMap,
  handleGlobalError,
  readDirRecursiveWithContents,
  zeBuildDashData,
  ze_log,
  ZephyrEngine,
  type ZephyrBuildHooks,
} from 'zephyr-agent';

type SnapshotType = 'csr' | 'ssr';

type NitroLike = {
  options?: {
    output?: {
      dir?: string;
      publicDir?: string;
    };
  };
};

const ENTRYPOINT_CANDIDATES = ['server/index.mjs', 'server/index.js', 'server/index.cjs'];

export interface ZephyrNuxtOptions {
  /** Override Nitro output directory (defaults to nitro.options.output.dir). */
  outputDir?: string;
  /** Explicit SSR entrypoint (relative to outputDir). */
  entrypoint?: string;
  /** Force snapshot type. Defaults to SSR if an entrypoint is found. */
  snapshotType?: SnapshotType;
  /** Optional Zephyr build hooks. */
  hooks?: ZephyrBuildHooks;
}

function normalizePath(value: string): string {
  return value.split(sep).join(posix.sep);
}

function resolveDir(rootDir: string, dir?: string): string | undefined {
  if (!dir) return undefined;
  return isAbsolute(dir) ? dir : resolve(rootDir, dir);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeEntrypoint(entrypoint: string, outputDir: string): string {
  let normalized = entrypoint.trim();

  if (isAbsolute(normalized)) {
    normalized = relative(outputDir, normalized);
  }

  normalized = normalizePath(normalized);

  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }

  while (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }

  const outputPosix = normalizePath(outputDir);
  if (normalized.startsWith(outputPosix)) {
    normalized = normalized.slice(outputPosix.length);
    normalized = normalized.replace(/^\/+/, '');
  }

  return normalized;
}

async function resolveEntrypoint(
  outputDir: string,
  entrypoint?: string
): Promise<string | undefined> {
  if (entrypoint) {
    return normalizeEntrypoint(entrypoint, outputDir);
  }

  for (const candidate of ENTRYPOINT_CANDIDATES) {
    const candidatePath = join(outputDir, candidate);
    if (await fileExists(candidatePath)) {
      return normalizeEntrypoint(candidate, outputDir);
    }
  }

  return undefined;
}

function resolveOutputDir(
  rootDir: string,
  outputDir?: string,
  fallback?: string
): string {
  const candidate = outputDir || fallback || '.output';
  return isAbsolute(candidate) ? candidate : resolve(rootDir, candidate);
}

export default defineNuxtModule<ZephyrNuxtOptions>({
  meta: {
    name: 'zephyr-nuxt-module',
    configKey: 'zephyr',
  },
  defaults: {},
  setup(options, nuxt) {
    if (nuxt.options.dev) return;

    const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

    let initialized = false;
    let uploadCompleted = false;

    const initEngine = () => {
      if (initialized) return;
      initialized = true;
      zephyr_defer_create({
        builder: 'nuxt',
        context: nuxt.options.rootDir,
      });
    };

    // Nuxt hook types don't include Nitro hook keys yet.
    const hook = nuxt.hook as unknown as (
      name: string,
      fn: (...args: any[]) => any
    ) => void;

    const runUpload = async (nitro?: NitroLike) => {
      if (uploadCompleted) return;
      uploadCompleted = true;
      initEngine();

      try {
        const zephyr_engine = await zephyr_engine_defer;
        ze_log.upload('Nuxt build done. Preparing Zephyr upload...');
        const nuxtNitro = (nuxt.options as any).nitro as
          | { output?: { dir?: string; publicDir?: string } }
          | undefined;
        const nitroOutputDir = nitro?.options?.output?.dir ?? nuxtNitro?.output?.dir;
        const nitroPublicDir =
          nitro?.options?.output?.publicDir ?? nuxtNitro?.output?.publicDir;

        const outputDir = resolveOutputDir(
          nuxt.options.rootDir,
          options.outputDir,
          nitroOutputDir
        );

        const publicDir = options.outputDir
          ? undefined
          : resolveDir(nuxt.options.rootDir, nitroPublicDir);

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

        const assets = files.reduce(
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

    // Run after Nuxt build completes to keep Zephyr logs at the end.
    hook('close', async () => {
      await runUpload();
    });
  },
});
