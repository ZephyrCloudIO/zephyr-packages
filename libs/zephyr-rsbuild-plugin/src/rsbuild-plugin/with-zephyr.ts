import { basename, relative, resolve, sep } from 'node:path';
import type { RsbuildPlugin } from '@rsbuild/core';
import {
  ZephyrEngine,
  handleGlobalError,
  readDirRecursiveWithContents,
  zeBuildAssets,
  zeBuildDashData,
  ze_log,
  type ZeBuildAssetsMap,
} from 'zephyr-agent';
import {
  withZephyr as rspackWithZephyr,
  type ZephyrBuildHooks,
} from 'zephyr-rspack-plugin';

type SnapshotType = 'csr' | 'ssr';
type UploadStrategy = 'auto' | 'per-environment' | 'combined';

interface EnvironmentContextLite {
  name: string;
  distPath: string;
}

interface CompilerConfigLite {
  context?: string;
}

export interface ZephyrRsbuildPluginOptions {
  wait_for_index_html?: boolean;
  hooks?: ZephyrBuildHooks;
  /**
   * Upload strategy:
   *
   * - `auto` (default): uses `combined` when an SSR/server environment is detected.
   * - `per-environment`: keeps the historical behavior (one upload per environment).
   * - `combined`: aggregates all environment outputs and uploads once.
   */
  upload_strategy?: UploadStrategy;
  /** Snapshot type override for combined uploads. */
  snapshot_type?: SnapshotType;
  /** Entrypoint override for SSR combined uploads. */
  entrypoint?: string;
}

export function withZephyr(options?: ZephyrRsbuildPluginOptions): RsbuildPlugin {
  let useCombinedUpload = false;
  let hasServerEnvironment = false;
  let sharedEnginePromise: Promise<ZephyrEngine> | null = null;

  return {
    name: 'zephyr-rsbuild-plugin',
    setup(api) {
      api.onBeforeCreateCompiler({
        order: 'post',
        handler: async ({ bundlerConfigs, environments }) => {
          hasServerEnvironment = detectServerEnvironment(environments);
          useCombinedUpload = shouldUseCombinedUpload(
            options?.upload_strategy,
            hasServerEnvironment
          );

          if (useCombinedUpload && !sharedEnginePromise) {
            const firstConfig = bundlerConfigs[0];
            const context = resolve(
              firstConfig?.context ??
                (api as { context?: { rootPath?: string } }).context?.rootPath ??
                process.cwd()
            );
            sharedEnginePromise = ZephyrEngine.create({
              builder: 'rspack',
              context,
            });
          }

          const sharedEngine = sharedEnginePromise
            ? await sharedEnginePromise
            : undefined;

          for (const config of bundlerConfigs as CompilerConfigLite[]) {
            const result = await rspackWithZephyr({
              wait_for_index_html: options?.wait_for_index_html,
              hooks: options?.hooks,
              disable_upload: useCombinedUpload,
              zephyr_engine: sharedEngine,
            })(config);

            if (result) {
              Object.assign(config, result);
            }
          }
        },
      });

      api.onAfterBuild({
        order: 'post',
        handler: async ({ environments }) => {
          if (!useCombinedUpload || !sharedEnginePromise) {
            return;
          }

          try {
            const engine = await sharedEnginePromise;
            const assetsMap = await collectEnvironmentAssetsMap(environments);
            const assetCount = Object.keys(assetsMap).length;

            if (assetCount === 0) {
              ze_log.upload('No build assets found for combined upload. Skipping.');
              return;
            }

            const snapshotType: SnapshotType =
              options?.snapshot_type ?? (hasServerEnvironment ? 'ssr' : 'csr');
            const entrypoint = normalizeEntrypoint(
              options?.entrypoint ?? inferEntrypoint(assetsMap, snapshotType)
            );

            if (snapshotType === 'ssr') {
              engine.env.ssr = true;
            }

            await engine.upload_assets({
              assetsMap,
              buildStats: await zeBuildDashData(engine),
              snapshotType,
              entrypoint,
              hooks: options?.hooks,
            });
          } catch (error) {
            handleGlobalError(error);
          }
        },
      });
    },
  };
}

function shouldUseCombinedUpload(
  strategy: UploadStrategy | undefined,
  hasServerEnvironment: boolean
): boolean {
  if (strategy === 'combined') return true;
  if (strategy === 'per-environment') return false;
  return hasServerEnvironment;
}

function detectServerEnvironment(
  environments: Record<string, EnvironmentContextLite | undefined>
): boolean {
  return Object.values(environments).some((environment) => {
    const name = environment?.name?.toLowerCase() ?? '';
    return name === 'ssr' || name === 'server' || name === 'node';
  });
}

function normalizeEntrypoint(entrypoint: string): string {
  let normalized = entrypoint.trim();
  normalized = normalized.split('\\').join('/');

  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }
  while (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }
  if (normalized.startsWith('dist/')) {
    normalized = normalized.slice('dist/'.length);
  }

  return normalized;
}

async function collectEnvironmentAssetsMap(
  environments: Record<string, EnvironmentContextLite | undefined>
): Promise<ZeBuildAssetsMap> {
  const assetsMap: ZeBuildAssetsMap = {};
  const seenFiles = new Set<string>();
  const envEntries = dedupeEnvironmentsByDistPath(
    Object.values(environments).filter(Boolean) as EnvironmentContextLite[]
  );

  if (envEntries.length === 0) {
    return assetsMap;
  }

  const sharedDistRoot = inferSharedDistRoot(envEntries.map((entry) => entry.distPath));
  const rootToPrefix = new Map<string, string>(
    envEntries.map((entry) => [entry.distPath, inferPrefix(entry)])
  );

  for (const environment of envEntries) {
    const files = await readDirRecursiveWithContents(environment.distPath);

    for (const file of files) {
      if (seenFiles.has(file.fullPath)) continue;
      seenFiles.add(file.fullPath);

      let outputPath: string;
      if (sharedDistRoot) {
        outputPath = normalizeAssetPath(relative(sharedDistRoot, file.fullPath));
      } else {
        const prefix = rootToPrefix.get(environment.distPath) ?? '';
        outputPath = normalizeAssetPath(
          prefix ? `${prefix}/${file.relativePath}` : file.relativePath
        );
      }

      if (!outputPath || outputPath.startsWith('..')) continue;

      const asset = zeBuildAssets({
        filepath: outputPath,
        content: file.content,
      });
      assetsMap[asset.hash] = asset;
    }
  }

  return assetsMap;
}

function dedupeEnvironmentsByDistPath(
  environments: EnvironmentContextLite[]
): EnvironmentContextLite[] {
  const result = new Map<string, EnvironmentContextLite>();
  for (const environment of environments) {
    const distPath = resolve(environment.distPath);
    if (!result.has(distPath)) {
      result.set(distPath, {
        ...environment,
        distPath,
      });
    }
  }
  return [...result.values()];
}

function inferSharedDistRoot(distPaths: string[]): string | null {
  if (distPaths.length === 0) return null;

  const normalized = distPaths.map((distPath) => resolve(distPath));
  const commonRoot = findCommonPath(normalized);
  if (commonRoot && basename(commonRoot) === 'dist') {
    return commonRoot;
  }

  return null;
}

function findCommonPath(paths: string[]): string | null {
  if (paths.length === 0) return null;
  if (paths.length === 1) return paths[0];

  const splitPaths = paths.map((currentPath) =>
    currentPath.split(sep).filter((part) => part.length > 0)
  );
  const minLength = Math.min(...splitPaths.map((parts) => parts.length));
  const sharedParts: string[] = [];

  for (let index = 0; index < minLength; index++) {
    const part = splitPaths[0][index];
    if (splitPaths.every((parts) => parts[index] === part)) {
      sharedParts.push(part);
    } else {
      break;
    }
  }

  if (sharedParts.length === 0) {
    return null;
  }

  const isAbsolute = paths[0].startsWith(sep);
  return `${isAbsolute ? sep : ''}${sharedParts.join(sep)}`;
}

function inferPrefix(environment: EnvironmentContextLite): string {
  const distBase = basename(environment.distPath);
  const envName = environment.name.toLowerCase();

  if (envName === 'web' && distBase === 'dist') {
    return '';
  }

  return distBase;
}

function inferEntrypoint(
  assetsMap: ZeBuildAssetsMap,
  snapshotType: SnapshotType
): string {
  const paths = new Set(
    Object.values(assetsMap).map((asset) => normalizeAssetPath(asset.path))
  );

  if (snapshotType === 'ssr') {
    const serverCandidates = [
      'server/server.js',
      'server/index.js',
      'ssr/server.js',
      'ssr/index.js',
      'index.js',
    ];

    for (const candidate of serverCandidates) {
      if (paths.has(candidate)) return candidate;
    }

    const dynamicMatch = [...paths].find(
      (currentPath) =>
        currentPath.endsWith('/server.js') || currentPath.endsWith('/index.js')
    );

    return dynamicMatch ?? 'server/server.js';
  }

  return paths.has('index.html') ? 'index.html' : 'index.js';
}

function normalizeAssetPath(filePath: string): string {
  return filePath
    .split('\\')
    .join('/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '');
}
