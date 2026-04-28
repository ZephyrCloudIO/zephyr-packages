import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import MagicString from 'magic-string';
import type { Plugin, ResolvedConfig, UserConfig } from 'vite' with {
  'resolution-mode': 'import',
};
import {
  createManifestContent,
  handleGlobalError,
  rewriteEnvReadsToVirtualModule,
  ze_log,
  zeBuildDashData,
  ZeErrors,
  ZephyrEngine,
  ZephyrError,
  type ZephyrBuildHooks,
} from 'zephyr-agent';
import { extractEntrypoint } from './internal/extract/extract-entrypoint.js';
import { extract_mf_plugin } from './internal/extract/extract_mf_plugin.js';
import { extract_vite_assets_map } from './internal/extract/extract_vite_assets_map.js';
import {
  ensureRuntimePlugin,
  RESOLVED_ZEPHYR_MF_RUNTIME_PLUGIN_ID,
  ZEPHYR_MF_RUNTIME_PLUGIN_ID,
  type ModuleFederationOptions,
} from './internal/mf-vite-etl/ensure_runtime_plugin.js';
import { replaceBundleChunkCode } from './internal/utils/replace-bundle-chunk-code.js';
import { extract_remotes_dependencies } from './internal/mf-vite-etl/extract-mf-vite-remotes';
import type { ZephyrInternalOptions } from './internal/types/zephyr-internal-options';

const DEFAULT_LIBRARY_TYPE = 'module';
const requireModule =
  typeof require === 'function'
    ? require
    : createRequire(`${process.cwd().replace(/\\/g, '/')}/package.json`);
const packageEntrypointPath = requireModule.resolve('vite-plugin-zephyr');
const runtimePluginPath = path.resolve(
  path.dirname(packageEntrypointPath),
  'lib/internal/mf-vite-etl/runtime_plugin.mjs'
);

export interface WithZephyrOptions {
  hooks?: ZephyrBuildHooks;
  mfConfig?: ModuleFederationOptions;
}

function loadModuleFederationPlugin() {
  let moduleFederation: {
    federation: (options: ModuleFederationOptions) => Plugin[];
  };

  try {
    moduleFederation = requireModule('@module-federation/vite') as {
      federation: (options: ModuleFederationOptions) => Plugin[];
    };
  } catch (error) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `vite-plugin-zephyr: @module-federation/vite is required when mfConfig is provided. Install a compatible version of @module-federation/vite to use Module Federation with withZephyr().${error instanceof Error ? ` Original error: ${error.message}` : ''}`,
    });
  }

  if (typeof moduleFederation.federation !== 'function') {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message:
        'vite-plugin-zephyr: failed to load @module-federation/vite federation plugin',
    });
  }

  return moduleFederation.federation;
}

function withZephyrCore(options: WithZephyrOptions = {}): Plugin {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  const hooks = options.hooks;

  let resolve_vite_internal_options: (value: ZephyrInternalOptions) => void;
  const vite_internal_options_defer = new Promise<ZephyrInternalOptions>((resolve) => {
    resolve_vite_internal_options = resolve;
  });

  let cachedSpecifier: string | undefined;
  let entrypoint: string;
  let mfConfig = options.mfConfig;

  return {
    name: 'with-zephyr',
    // Run before Vite's env replacement so ZE_PUBLIC_* reads can be rewritten first.
    enforce: 'pre',

    config: (config: UserConfig) => {
      // If MF was configured separately, inject the Zephyr runtime plugin before MF emits.
      const detectedMfConfig = extract_mf_plugin(config.plugins ?? [])?._options;
      if (detectedMfConfig) {
        mfConfig = ensureRuntimePlugin(detectedMfConfig);
      }
      return null;
    },

    configResolved: async (config: ResolvedConfig) => {
      const root = config.root;
      // Normalize the entrypoint early so uploads use the same path in serve/build.
      entrypoint = extractEntrypoint(config);

      // Initialize the Zephyr engine in both serve and build flows.
      zephyr_defer_create({
        builder: 'vite',
        context: root,
      });

      resolve_vite_internal_options({
        root,
        outDir: config.build?.outDir,
        publicDir: config.publicDir,
      });

      const detectedMfConfig = extract_mf_plugin(config.plugins ?? [])?._options;
      if (detectedMfConfig) {
        mfConfig = ensureRuntimePlugin(detectedMfConfig);
      }
      mfConfig ??= detectedMfConfig;

      if (mfConfig) {
        try {
          // Resolve remotes early so zephyr-manifest.json includes runtime dependencies.
          const dependencyPairs = extract_remotes_dependencies(root, mfConfig);
          if (dependencyPairs) {
            const zephyr_engine = await zephyr_engine_defer;
            await zephyr_engine.resolve_remote_dependencies(
              dependencyPairs,
              DEFAULT_LIBRARY_TYPE
            );
            ze_log.remotes(
              `Resolved ${dependencyPairs.length} remote dependencies in configResolved`
            );
          }
        } catch (error) {
          handleGlobalError(error);
        }
      }

      try {
        const { loadEnv } = await import('vite');
        // Mirror ZE_PUBLIC_* into process.env for agent-side manifest generation.
        const loaded = loadEnv(config.mode || 'production', root, '');
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
        // ignore if loadEnv unavailable
      }
    },

    resolveId: async (source) => {
      if (source === ZEPHYR_MF_RUNTIME_PLUGIN_ID) {
        return RESOLVED_ZEPHYR_MF_RUNTIME_PLUGIN_ID;
      }

      try {
        const zephyr_engine = await zephyr_engine_defer;
        if (!cachedSpecifier) {
          cachedSpecifier = `env:vars:${zephyr_engine.application_uid}`;
        }
        if (source === cachedSpecifier) {
          if (process.env['NODE_ENV'] === 'development') {
            // Keep dev env imports aligned with the manifest JSON route used by other Zephyr plugins.
            return '/zephyr-manifest.json';
          }
          return { id: source, external: true };
        }
      } catch {
        // ignore
      }
      return null;
    },

    load: async (id) => {
      if (id === RESOLVED_ZEPHYR_MF_RUNTIME_PLUGIN_ID) {
        return readFile(runtimePluginPath, 'utf8');
      }

      return null;
    },

    transform: {
      order: 'post',
      // Limit transforms to source-like files plus MF's in-memory remote entry.
      filter: {
        id: /\.(mjs|cjs|js|ts|jsx|tsx)/,
      },
      handler: async (code, id) => {
        try {
          // Rewrite ZE_PUBLIC_* reads in app code; node_modules stay untouched.
          if (!id.includes('node_modules')) {
            const zephyr_engine = await zephyr_engine_defer;
            if (!cachedSpecifier) {
              cachedSpecifier = `env:vars:${zephyr_engine.application_uid}`;
            }
            const res = rewriteEnvReadsToVirtualModule(String(code), cachedSpecifier);
            if (res && typeof res.code === 'string' && res.code !== code) {
              code = res.code;
              return {
                code,
                map: new MagicString(code).generateMap({
                  hires: true,
                }),
              };
            }
          }

          return null;
        } catch (error) {
          handleGlobalError(error);
          return null;
        }
      },
    },

    generateBundle: async function (_outputOptions, bundle) {
      if (cachedSpecifier) {
        for (const [fileName, chunk] of Object.entries(bundle)) {
          if (
            chunk &&
            typeof chunk === 'object' &&
            'type' in chunk &&
            chunk.type === 'chunk' &&
            'code' in chunk
          ) {
            // Preserve JSON import assertions after bundling so runtime import maps still work.
            const importWithoutAssertion = new RegExp(
              `import\\s+([^\\s]+)\\s+from\\s*['"]${cachedSpecifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
              'g'
            );

            if (chunk.code.match(importWithoutAssertion)) {
              const nextCode = chunk.code.replace(
                importWithoutAssertion,
                `import $1 from '${cachedSpecifier}' with { type: 'json' }`
              );
              replaceBundleChunkCode(bundle, fileName, chunk, nextCode);
            }
          }
        }
      }

      try {
        const zephyr_engine = await zephyr_engine_defer;
        const dependencies = zephyr_engine.federated_dependencies || [];
        const manifestContent = createManifestContent(dependencies, true);

        this.emitFile({
          type: 'asset',
          fileName: 'zephyr-manifest.json',
          source: manifestContent,
        });
      } catch (error) {
        handleGlobalError(error);
        this.emitFile({
          type: 'asset',
          fileName: 'zephyr-manifest.json',
          source: JSON.stringify(
            {
              version: '1.0.0',
              timestamp: new Date().toISOString(),
              dependencies: {},
              zeVars: {},
            },
            null,
            2
          ),
        });
      }
    },

    configureServer: async (server) => {
      try {
        const zephyr_engine = await zephyr_engine_defer;
        if (!cachedSpecifier) {
          cachedSpecifier = `env:vars:${zephyr_engine.application_uid}`;
        }

        server.middlewares.use((req, res, next) => {
          void (async () => {
            if (!req.url) {
              next();
              return;
            }

            const requestUrl = req.url.split('?')[0];

            if (requestUrl === '/zephyr-manifest.json') {
              try {
                const dependencies = zephyr_engine.federated_dependencies || [];
                const manifestContent = createManifestContent(dependencies, true);
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(manifestContent);
                return;
              } catch (error) {
                handleGlobalError(error);
              }
            }

            next();
          })();
        });
      } catch {
        // ignore
      }
    },

    writeBundle: async function (options, bundle) {
      try {
        const [vite_internal_options, zephyr_engine] = await Promise.all([
          vite_internal_options_defer,
          zephyr_engine_defer,
        ]);

        vite_internal_options.dir = options.dir;
        vite_internal_options.assets = bundle;

        const assetsMap = await extract_vite_assets_map(
          zephyr_engine,
          vite_internal_options
        );

        await zephyr_engine.upload_assets({
          assetsMap,
          buildStats: await zeBuildDashData(zephyr_engine),
          hooks,
          entrypoint,
          snapshotType: 'csr',
        });

        await zephyr_engine.build_finished();
      } catch (error) {
        handleGlobalError(error);
      }
    },
  };
}

export function withZephyr(options: WithZephyrOptions = {}): Plugin[] {
  const plugins: Plugin[] = [];

  if (options.mfConfig) {
    const federation = loadModuleFederationPlugin();
    plugins.push(...federation(ensureRuntimePlugin(options.mfConfig)));
  }

  plugins.push(withZephyrCore(options));
  return plugins;
}
