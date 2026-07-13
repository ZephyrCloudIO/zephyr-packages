/** Vite plugin for deploying TanStack Start applications to Zephyr */

import type { Plugin, ResolvedConfig } from 'vite' with {
  'resolution-mode': 'import',
};
import type { OutputAsset, OutputChunk } from 'rollup';
import * as path from 'path';
import {
  ApplicationContext,
  assertZephyrBuildTarget,
  ZephyrEngine,
  type ZephyrEngineOptions,
  type ZephyrBuildTarget,
  type ZephyrLegacyModuleFederationConfig,
  type ZephyrModuleFederationBuildMetadata,
  type ZephyrModuleFederationConfig,
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
  /** Zephyr artifact family, including `tap-app` for TAP packages. */
  target?: ZephyrBuildTarget;
  /** Every independently published Module Federation container. */
  mfConfigs?: ZephyrModuleFederationConfig[];
  /** Build-stat metadata paired with `mfConfigs`. */
  federation?: ZephyrModuleFederationBuildMetadata[];
  /**
   * Optional output directory override Defaults to 'dist' relative to project root
   * (TanStack Start default)
   */
  outputDir?: string;
  /**
   * Snapshot transport type. Ordinary TanStack Start deployments default to SSR; TAP
   * packages default to CSR unless this is explicitly set to `ssr`.
   */
  snapshotType?: 'csr' | 'ssr';
  /**
   * Server entry file path for an SSR snapshot.
   *
   * This should be a path **relative to the TanStack Start output directory** (usually
   * `dist/`). For example: `server/index.js`.
   *
   * Defaults to `server/index.js` when `snapshotType` is `ssr`.
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

function resolveSnapshotType(options: TanStackStartZephyrOptions): 'csr' | 'ssr' {
  return options.snapshotType ?? (options.target === 'tap-app' ? 'csr' : 'ssr');
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * TAP has no framework-owned Module Federation metadata source. Require callers to
 * provide the complete, paired snapshot and dashboard records rather than publishing a
 * package that the control plane cannot address deterministically.
 */
function assertTapFederationMetadata(options: TanStackStartZephyrOptions): void {
  if (options.target !== 'tap-app') {
    return;
  }

  const { mfConfigs, federation } = options;
  if (!Array.isArray(mfConfigs) || mfConfigs.length === 0) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: 'tap-app metadata must include a non-empty mfConfigs array.',
    });
  }
  if (!Array.isArray(federation) || federation.length === 0) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: 'tap-app metadata must include a non-empty federation array.',
    });
  }
  if (mfConfigs.length !== federation.length) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message:
        'tap-app metadata must include the same number of mfConfigs and federation entries.',
    });
  }

  const federationByName = new Map<string, ZephyrModuleFederationBuildMetadata>();
  const federationRemotes = new Set<string>();
  for (const entry of federation) {
    const { name, remote } = entry;
    if (!isNonEmptyString(name) || !isNonEmptyString(remote)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message:
          'tap-app federation metadata entries must each include a non-empty name and remote.',
      });
    }
    if (federationByName.has(name) || federationRemotes.has(remote)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message:
          'tap-app federation metadata entries must have unique names and remotes.',
      });
    }
    federationByName.set(name, entry);
    federationRemotes.add(remote);
  }

  const configNames = new Set<string>();
  const configFilenames = new Set<string>();
  for (const config of mfConfigs) {
    const { name, filename } = config;
    if (!isNonEmptyString(name) || !isNonEmptyString(filename)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message:
          'tap-app mfConfigs entries must each include a non-empty name and filename.',
      });
    }
    if (configNames.has(name) || configFilenames.has(filename)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message: 'tap-app mfConfigs entries must have unique names and filenames.',
      });
    }
    configNames.add(name);
    configFilenames.add(filename);

    const federationEntry = federationByName.get(name);
    if (!federationEntry || federationEntry.remote !== filename) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message:
          `tap-app metadata must pair mfConfigs entry ${JSON.stringify(name)} with a ` +
          `federation entry using remote ${JSON.stringify(filename)}.`,
      });
    }
  }
}

/**
 * Old consumers only understand one complete container. Keep that compatibility field
 * unambiguous while always retaining the full typed `mfConfigs` array for TAP.
 */
function getLegacyModuleFederationConfig(
  mfConfigs: readonly ZephyrModuleFederationConfig[] | undefined
): ZephyrLegacyModuleFederationConfig | undefined {
  const config = mfConfigs?.length === 1 ? mfConfigs[0] : undefined;
  if (
    !config ||
    typeof config.name !== 'string' ||
    !config.name.trim() ||
    typeof config.filename !== 'string' ||
    !config.filename.trim()
  ) {
    return undefined;
  }

  return config as ZephyrLegacyModuleFederationConfig;
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
  if (options.target !== undefined) {
    assertZephyrBuildTarget(options.target, 'withZephyr({ target })');
  }
  assertTapFederationMetadata(options);

  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  const snapshotType = resolveSnapshotType(options);
  let config: ResolvedConfig;
  let outputDir: string;
  let entrypoint: string | undefined;
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
      entrypoint =
        snapshotType === 'ssr'
          ? normalizeEntrypoint(options.entrypoint || 'server/index.js')
          : undefined;
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
              ...(options.target === undefined ? {} : { target: options.target }),
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
            publish: async ({ assetsMap }) => {
              // Options can be held by a user-owned config object until the framework
              // finishes. Revalidate immediately before transport so a later mutation
              // cannot turn a valid TAP setup into an incomplete publication.
              assertTapFederationMetadata(options);
              const buildStats = await zeBuildDashData(zephyr_engine);
              const mfConfig = getLegacyModuleFederationConfig(options.mfConfigs);
              await zephyr_engine.upload_assets({
                assetsMap,
                buildStats:
                  options.federation === undefined
                    ? buildStats
                    : { ...buildStats, federation: options.federation },
                ...(mfConfig ? { mfConfig } : {}),
                ...(options.mfConfigs === undefined
                  ? {}
                  : { mfConfigs: options.mfConfigs }),
                snapshotType,
                ...(snapshotType === 'ssr' ? { entrypoint } : {}),
              });
            },
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
              { name: outputParticipant, role: snapshotType },
            ],
            postprocessors: ['tanstack-start'],
            strictAssetPaths: options.target === 'tap-app',
          });

          for (const [name] of environments) {
            session.completeParticipant(name);
          }

          // Read from the shared output root only after every child compiler and the
          // framework's post-build hook have completed. This preserves client/, server/,
          // prerendered HTML, public files, and generated manifests as one snapshot.
          const bundle = await loadTanStackOutput(outputDir, { target: options.target });
          const assetsMap = buildAssetsMap(bundle, extractBuffer, getAssetType);
          if (
            snapshotType === 'ssr' &&
            (!entrypoint ||
              !Object.values(assetsMap).some((asset) => asset.path === entrypoint))
          ) {
            throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
              message: `TanStack Start server entrypoint "${entrypoint ?? ''}" was not emitted under "${outputDir}".`,
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
