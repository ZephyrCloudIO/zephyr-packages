/** Vite plugin for deploying TanStack Start applications to Zephyr */

import type { Plugin, ResolvedConfig } from 'vite' with {
  'resolution-mode': 'import',
};
import type { OutputAsset, OutputChunk } from 'rollup';
import * as path from 'path';
import {
  ApplicationContext,
  ZephyrEngine,
  type ZephyrEngineOptions,
  zeBuildDashData,
  buildAssetsMap,
  ZeErrors,
  ZephyrError,
  ze_log,
  handleGlobalError,
} from 'zephyr-agent';
import { loadTanStackOutput } from './internal/extract/load-tanstack-output';

/** Extract buffer from Rollup output */
function extractBuffer(item: OutputAsset | OutputChunk): Buffer {
  if (item.type === 'chunk') {
    return Buffer.from(item.code, 'utf-8');
  } else if (item.type === 'asset') {
    if (typeof item.source === 'string') {
      return Buffer.from(item.source, 'utf-8');
    } else if (Buffer.isBuffer(item.source)) {
      return item.source;
    } else {
      return Buffer.from(item.source);
    }
  }
  return Buffer.from('');
}

/** Get asset type from Rollup output item */
function getAssetType(item: { fileName?: string; name?: string }): string {
  const fileName = item.fileName || item.name || '';
  const ext = path.extname(fileName).toLowerCase();
  const typeMap: Record<string, string> = {
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.cjs': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.json': 'application/json',
  };
  return typeMap[ext] || 'application/octet-stream';
}

/**
 * Plugin options for TanStack Start Zephyr deployment All configuration is handled
 * automatically by ZephyrEngine via package.json and git info
 */
export interface TanStackStartZephyrOptions {
  /**
   * Optional output directory override Defaults to 'dist' relative to project root
   * (TanStack Start default)
   */
  outputDir?: string;
  /**
   * Server entry file path for SSR.
   *
   * This should be a path **relative to the TanStack Start output directory** (usually
   * `dist/`). For example: `server/index.js`.
   *
   * Defaults to `server/index.js`.
   */
  entrypoint?: string;
}

export function resolveTanStackOutputDir(root: string, outputDir?: string): string {
  if (!outputDir) return path.join(root, 'dist');
  return path.isAbsolute(outputDir) ? outputDir : path.resolve(root, outputDir);
}

function uniqueParticipant(base: string, reserved: readonly string[]): string {
  let participant = base;
  let suffix = 1;
  const used = new Set(reserved);
  while (used.has(participant)) participant = `${base}-${suffix++}`;
  return participant;
}

function normalizeEntrypoint(entrypoint: string): string {
  let normalized = entrypoint.trim();
  // Normalize separators to match snapshot asset keys (posix-style).
  normalized = normalized.split('\\').join('/');

  // Remove common leading prefixes users may provide.
  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }
  while (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }
  if (normalized.startsWith('dist/')) {
    normalized = normalized.slice('dist/'.length);
  }
  const segments = normalized.split('/').filter((segment) => segment && segment !== '.');
  if (!normalized || segments.length === 0 || segments.includes('..')) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: `TanStack Start entrypoint must be inside the output directory: "${entrypoint}".`,
    });
  }
  return segments.join('/');
}

/**
 * Main Vite plugin for TanStack Start Zephyr deployment
 *
 * Configuration is automatically detected from:
 *
 * - Package.json (app name, version)
 * - Git info (org, project, branch)
 * - Zephyr auth (via ze login)
 */
export function withZephyr(options: TanStackStartZephyrOptions = {}): Plugin {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  let config: ResolvedConfig;
  let outputDir: string;
  let entrypoint: string;
  let engineCreated = false;
  let buildGeneration = 0;
  let applicationContext: ApplicationContext | undefined;

  return {
    name: 'vite-plugin-tanstack-start-zephyr',
    enforce: 'post', // Run after TanStack Start plugin

    configResolved(resolvedConfig) {
      config = resolvedConfig;

      // For TanStack Start, always use the root dist directory (contains server/ and client/)
      // Don't use config.build.outDir as it points to dist/server/ during SSR build
      outputDir = resolveTanStackOutputDir(config.root, options.outputDir);
      entrypoint = normalizeEntrypoint(options.entrypoint || 'server/index.js');
    },

    buildApp: {
      // TanStack performs prerendering and other framework post-processing from its own
      // buildApp hook. A post-ordered hook observes the final client/server output.
      order: 'post',
      async handler(builder) {
        const environments = Object.entries(builder.environments);
        if (environments.length === 0) {
          throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
            message: 'TanStack Start exposed no build environments for publication.',
          });
        }
        const notBuilt = environments
          .filter(([, environment]) => !environment.isBuilt)
          .map(([name]) => name);

        if (notBuilt.length > 0) {
          throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
            message:
              `TanStack Start completed without these environments: ${notBuilt.join(', ')}. ` +
              'Zephyr will not force child compilers or publish a partial deployment.',
          });
        }

        ze_log.init(
          `TanStack Start build complete for ${environments.map(([name]) => name).join(', ')}`
        );

        try {
          if (!engineCreated) {
            const engineOptions: ZephyrEngineOptions = {
              builder: 'vite',
              context: config.root,
            };
            zephyr_defer_create(engineOptions);
            engineCreated = true;
          }
          const zephyr_engine = await zephyr_engine_defer;
          const generation = buildGeneration++;
          const invocationId = `tanstack-start-${generation}`;

          applicationContext ??= new ApplicationContext({
            applicationUid: zephyr_engine.application_uid,
            // ZephyrEngine.create starts generation zero; later watch generations need a
            // fresh build ID and empty hash/snapshot state.
            prepare: ({ generation: nextGeneration }) =>
              nextGeneration === 0 ? undefined : zephyr_engine.start_new_build(),
            publish: async ({ assetsMap }) =>
              zephyr_engine.upload_assets({
                assetsMap,
                buildStats: await zeBuildDashData(zephyr_engine),
                snapshotType: 'ssr',
                entrypoint,
              }),
            finish: () => zephyr_engine.build_finished(),
            onFailure: () => zephyr_engine.build_failed(),
          });

          const outputParticipant = uniqueParticipant(
            'tanstack-output',
            environments.map(([name]) => name)
          );
          const session = applicationContext.beginBuild({
            invocationId,
            generation,
            participants: [
              ...environments.map(([name]) => ({ name, role: name })),
              { name: outputParticipant, role: 'ssr' },
            ],
            postprocessors: ['tanstack-start'],
          });

          for (const [name] of environments) {
            session.completeParticipant(name);
          }

          // Read from the shared output root only after every child compiler and the
          // framework's post-build hook have completed. This preserves client/, server/,
          // prerendered HTML, public files, and generated manifests as one snapshot.
          const bundle = await loadTanStackOutput(outputDir);
          const assetsMap = buildAssetsMap(bundle, extractBuffer, getAssetType);
          if (!Object.values(assetsMap).some((asset) => asset.path === entrypoint)) {
            throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
              message: `TanStack Start server entrypoint "${entrypoint}" was not emitted under "${outputDir}".`,
            });
          }
          session.contribute({
            participant: outputParticipant,
            key: outputDir,
            assetsMap,
          });
          session.completeParticipant(outputParticipant);
          session.completePostprocess('tanstack-start');

          ze_log.upload(`Uploading ${Object.keys(assetsMap).length} TanStack assets...`);
          await session.publish();
          ze_log.upload('TanStack Start deployment successful!');
        } catch (error) {
          if (engineCreated) {
            try {
              const zephyr_engine = await zephyr_engine_defer;
              zephyr_engine.build_failed();
            } catch {
              // Engine initialization failed before any reusable build state existed.
            }
          }
          handleGlobalError(error);
        }
      },
    },
  };
}

/** @deprecated Please use `withZephyr` instead. */
export const withZephyrTanstackStart = withZephyr;
