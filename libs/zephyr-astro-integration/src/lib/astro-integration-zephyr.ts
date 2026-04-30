import type { AstroIntegration, HookParameters } from 'astro';
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

export function withZephyr(options?: ZephyrAstroOptions): AstroIntegration {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  const hooks = options?.hooks;
  let cachedSpecifier: string | undefined;

  const viteZePublicPlugin = {
    name: 'with-zephyr-astro-env',
    enforce: 'pre' as const,
    configResolved: async (config: { mode?: string; root?: string }) => {
      try {
        const vite = require('vite') as {
          loadEnv?: (
            mode: string,
            envDir: string,
            prefixes: string
          ) => Record<string, string>;
        };
        const loaded =
          typeof vite.loadEnv === 'function'
            ? vite.loadEnv(config.mode || 'production', config.root || process.cwd(), '')
            : {};

        for (const [k, v] of Object.entries(loaded)) {
          if (
            k.startsWith('ZE_PUBLIC_') &&
            typeof v === 'string' &&
            !(k in process.env)
          ) {
            process.env[k] = v;
          }
        }
      } catch {
        // ignore if vite loadEnv is unavailable
      }
    },
    resolveId: async (source: string) => {
      try {
        const zephyr_engine = await zephyr_engine_defer;
        if (!cachedSpecifier) {
          cachedSpecifier = `env:vars:${zephyr_engine.application_uid}`;
        }
        if (source === cachedSpecifier) {
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
    transform: async (code: string, id: string) => {
      try {
        if (id.includes('node_modules')) {
          return null;
        }

        const zephyr_engine = await zephyr_engine_defer;
        if (!cachedSpecifier) {
          cachedSpecifier = `env:vars:${zephyr_engine.application_uid}`;
        }

        const res = rewriteEnvReadsToVirtualModule(String(code), cachedSpecifier);
        if (res && typeof res.code === 'string' && res.code !== code) {
          return {
            code: res.code,
            map: null,
          };
        }
      } catch (error) {
        handleGlobalError(error);
      }

      return null;
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
        try {
          const zephyr_engine = await zephyr_engine_defer;

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
          await zephyr_engine.build_finished();
        } catch (error) {
          handleGlobalError(error);
        }
      },
    },
  };
}
