import type { AstroIntegration, HookParameters } from 'astro' with {
  'resolution-mode': 'import',
};
import type { Plugin, ResolvedConfig } from 'vite' with {
  'resolution-mode': 'import',
};
import { fileURLToPath } from 'node:url';
import {
  handleGlobalError,
  rewriteEnvReadsToVirtualModule,
  zeBuildDashData,
  ZephyrEngine,
  type ZephyrBuildHooks,
} from 'zephyr-agent';
import { extractAstroAssetsFromBuildHook } from './internal/extract-astro-assets-map';

type AstroBuildDoneParams = HookParameters<'astro:build:done'> & {
  assets?: Record<string, unknown> | Map<string, unknown> | Array<unknown>;
};

export interface ZephyrAstroOptions {
  hooks?: ZephyrBuildHooks;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function withZephyr(options?: ZephyrAstroOptions): AstroIntegration {
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
        if (!cachedSpecifier) return null;

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
        updateConfig({
          vite: {
            plugins: [viteZePublicPlugin],
          },
        });
      },
      'astro:config:done': async ({ config }: HookParameters<'astro:config:done'>) => {
        // config.root is a URL object, convert to file path
        const contextPath = fileURLToPath(config.root);
        // Initialize ZephyrEngine with Astro context
        zephyr_defer_create({
          builder: 'astro',
          context: contextPath,
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
          const assetsMap = await extractAstroAssetsFromBuildHook(assets, outputPath);

          // Upload assets and build stats
          await zephyr_engine.upload_assets({
            assetsMap,
            buildStats: await zeBuildDashData(zephyr_engine),
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
