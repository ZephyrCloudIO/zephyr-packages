import type { AstroIntegration, HookParameters } from 'astro' with {
  'resolution-mode': 'import',
};
import type { Plugin, ResolvedConfig } from 'vite' with {
  'resolution-mode': 'import',
};
import { fileURLToPath } from 'node:url';
import type {
  ZephyrLegacyModuleFederationConfig,
  ZephyrModuleFederationBuildMetadata,
  ZephyrModuleFederationConfig,
} from 'zephyr-edge-contract';
import {
  assertZephyrBuildTarget,
  handleGlobalError,
  rewriteEnvReadsToVirtualModule,
  ZeErrors,
  zeBuildDashData,
  ZephyrError,
  ZephyrEngine,
  type ZephyrBuildHooks,
  type ZephyrBuildTarget,
} from 'zephyr-agent';
import { extractAstroAssetsFromBuildHook } from './internal/extract-astro-assets-map';

type AstroBuildDoneParams = HookParameters<'astro:build:done'> & {
  assets?: Record<string, unknown> | Map<string, unknown> | Array<unknown>;
};

export interface ZephyrAstroOptions {
  /** Zephyr artifact family, including `tap-app` for TAP packages. */
  target?: ZephyrBuildTarget;
  /** Every JSON-serializable Module Federation config emitted by the package SDK. */
  mfConfigs?: ZephyrModuleFederationConfig[];
  /** Dashboard metadata paired with each entry in `mfConfigs`. */
  federation?: ZephyrModuleFederationBuildMetadata[];
  hooks?: ZephyrBuildHooks;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim();
}

/**
 * Keep the legacy snapshot field only for its unambiguous, complete shape. The complete
 * `mfConfigs` array remains the source of truth for multi-container publications.
 */
function getLegacyModuleFederationConfig(
  mfConfigs: ZephyrAstroOptions['mfConfigs']
): ZephyrLegacyModuleFederationConfig | undefined {
  const config = mfConfigs?.length === 1 ? mfConfigs[0] : undefined;
  if (!config || !nonEmptyString(config.name) || !nonEmptyString(config.filename)) {
    return undefined;
  }

  return config as ZephyrLegacyModuleFederationConfig;
}

/**
 * TAP descriptors identify every remote by its container name and entry filename. The
 * adapter does not interpret that SDK data, but must reject an incomplete pairing rather
 * than upload a package whose snapshot and dashboard disagree.
 */
function assertTapModuleFederationMetadata(
  target: ZephyrBuildTarget | undefined,
  mfConfigs: ZephyrAstroOptions['mfConfigs'],
  federation: ZephyrAstroOptions['federation']
): void {
  if (target !== 'tap-app') {
    return;
  }

  if (!mfConfigs?.length || !federation?.length) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message:
        'Astro TAP publication requires non-empty mfConfigs and federation metadata arrays.',
    });
  }
  if (mfConfigs.length !== federation.length) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message:
        'Astro TAP mfConfigs and federation metadata must contain the same number of entries.',
    });
  }

  const federationByName = new Map<string, ZephyrModuleFederationBuildMetadata>();
  const remotes = new Set<string>();
  for (const metadata of federation) {
    if (!nonEmptyString(metadata.name) || !nonEmptyString(metadata.remote)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message:
          'Astro TAP federation metadata requires a non-empty name and remote for every container.',
      });
    }
    if (federationByName.has(metadata.name) || remotes.has(metadata.remote)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message:
          'Astro TAP federation metadata entries must not duplicate names or remotes.',
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
          'Astro TAP mfConfigs requires a non-empty name and filename for every container.',
      });
    }
    if (names.has(config.name) || filenames.has(config.filename)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message: 'Astro TAP mfConfigs entries must not duplicate names or filenames.',
      });
    }
    if (federationByName.get(config.name)?.remote !== config.filename) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message: `Astro TAP federation metadata has no matching name and remote for mfConfigs entry "${config.name}" at "${config.filename}".`,
      });
    }
    names.add(config.name);
    filenames.add(config.filename);
  }
}

export function withZephyr(options?: ZephyrAstroOptions): AstroIntegration {
  if (options?.target !== undefined) {
    assertZephyrBuildTarget(options.target, 'withZephyr({ target })');
  }

  const preserveTapArtifactBytes = options?.target === 'tap-app';
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  const hooks = options?.hooks;
  let cachedSpecifier: string | undefined;

  const getEnvSpecifier = async (): Promise<string> => {
    if (!cachedSpecifier) {
      const zephyrEngine = await zephyr_engine_defer;
      cachedSpecifier = `env:vars:${zephyrEngine.application_uid}`;
    }
    return cachedSpecifier;
  };

  const viteZePublicPlugin: Plugin = {
    name: 'with-zephyr-astro-env',
    // Run before Vite replaces import.meta.env so ZE_PUBLIC_* reads stay dynamic.
    enforce: 'pre' as const,
    configResolved: async (config: ResolvedConfig) => {
      if (preserveTapArtifactBytes) {
        return;
      }

      // Vite 8 is ESM-only. Load its runtime API natively so this integration can
      // continue publishing both CommonJS and ESM entrypoints.
      const vite = await import('vite');
      try {
        const loaded = vite.loadEnv(config.mode || 'production', config.root, '');

        for (const [k, v] of Object.entries(loaded)) {
          if (
            k.startsWith('ZE_PUBLIC_') &&
            typeof v === 'string' &&
            !(k in process.env)
          ) {
            process.env[k] = v;
          }
        }
      } catch (error) {
        handleGlobalError(error);
      }
    },
    resolveId: async (source: string) => {
      if (preserveTapArtifactBytes) {
        return null;
      }

      try {
        const specifier = await getEnvSpecifier();
        if (source === specifier) {
          if (process.env['NODE_ENV'] === 'development') {
            return '/zephyr-manifest.json';
          }
          return { id: source, external: true };
        }
      } catch {
        // ignore
      }
      return null;
    },
    transform: {
      order: 'post',
      filter: {
        id: /\.(mjs|cjs|js|ts|jsx|tsx)(?:$|\?)/,
      },
      handler: async (code: string, id: string) => {
        if (preserveTapArtifactBytes) {
          return null;
        }

        try {
          if (id.includes('node_modules')) {
            return null;
          }

          const specifier = await getEnvSpecifier();
          const result = rewriteEnvReadsToVirtualModule(String(code), specifier);
          if (result.code !== code) {
            return {
              code: result.code,
              map: null,
            };
          }
        } catch (error) {
          handleGlobalError(error);
        }

        return null;
      },
    },
    renderChunk: {
      order: 'post',
      handler(code) {
        if (preserveTapArtifactBytes || !cachedSpecifier) return null;

        // Vite can omit the JSON attribute when it re-emits an external import.
        const importWithoutAttribute = new RegExp(
          `import\\s+([^\\s]+)\\s+from\\s*['"]${escapeRegExp(cachedSpecifier)}['"](?!\\s+with\\s*\\{)`,
          'g'
        );
        const nextCode = code.replace(
          importWithoutAttribute,
          `import $1 from '${cachedSpecifier}' with { type: 'json' }`
        );
        return nextCode === code ? null : { code: nextCode, map: null };
      },
    },
  };

  return {
    name: 'with-zephyr',
    hooks: {
      'astro:config:setup': ({ updateConfig }: HookParameters<'astro:config:setup'>) => {
        // TAP packages publish SDK-validated output. Do not register the Vite plugin
        // that rewrites source/chunk bytes for conventional Zephyr deployments.
        if (!preserveTapArtifactBytes) {
          updateConfig({
            vite: {
              plugins: [viteZePublicPlugin],
            },
          });
        }
      },
      'astro:config:done': async ({ config }: HookParameters<'astro:config:done'>) => {
        // config.root is a URL object, convert to file path
        const contextPath = fileURLToPath(config.root);
        // Initialize ZephyrEngine with Astro context
        zephyr_defer_create({
          builder: 'astro',
          context: contextPath,
          ...(options?.target === undefined ? {} : { target: options.target }),
        });
      },
      'astro:build:done': async ({
        dir,
        ...params
      }: HookParameters<'astro:build:done'>) => {
        let zephyr_engine: ZephyrEngine | undefined;
        let buildInProgress = false;
        try {
          zephyr_engine = await zephyr_engine_defer;
          // create() has already allocated generation zero.
          buildInProgress = true;

          // Convert URL to file system path
          const outputPath = fileURLToPath(dir);

          // Set output directory for ZephyrEngine
          zephyr_engine.buildProperties.output = outputPath;

          // Start a new build
          await zephyr_engine.start_new_build();

          // Extract assets from params if available (Astro v5+), fallback to filesystem walking
          const assets = (params as AstroBuildDoneParams).assets;
          const assetsMap = await extractAstroAssetsFromBuildHook(
            assets,
            outputPath,
            options?.target
          );

          // Upload assets and build stats
          assertTapModuleFederationMetadata(
            options?.target,
            options?.mfConfigs,
            options?.federation
          );
          const buildStats = await zeBuildDashData(zephyr_engine);
          const mfConfig = getLegacyModuleFederationConfig(options?.mfConfigs);
          await zephyr_engine.upload_assets({
            assetsMap,
            buildStats:
              options?.federation === undefined
                ? buildStats
                : { ...buildStats, federation: options.federation },
            ...(mfConfig === undefined ? {} : { mfConfig }),
            ...(options?.mfConfigs === undefined ? {} : { mfConfigs: options.mfConfigs }),
            hooks,
          });

          // Mark build as finished
          buildInProgress = false;
          await zephyr_engine.build_finished();
        } catch (error) {
          handleGlobalError(error);
        } finally {
          if (buildInProgress && zephyr_engine?.hasActiveBuild !== false) {
            zephyr_engine?.build_failed();
          }
        }
      },
    },
  };
}
