import { federation } from '@module-federation/vite';
import { loadEnv, type Plugin, type ResolvedConfig } from 'vite';
import {
  buildEnvImportMap,
  createManifestContent,
  handleGlobalError,
  rewriteEnvReadsToVirtualModule,
  zeBuildDashData,
  ZephyrEngine,
  type RemoteEntry,
  type ZephyrBuildHooks,
} from 'zephyr-agent';
import { extract_mf_plugin } from './internal/extract/extract_mf_plugin';
import { extract_vite_assets_map } from './internal/extract/extract_vite_assets_map';
import { extract_remotes_dependencies } from './internal/mf-vite-etl/extract-mf-vite-remotes';
import { load_resolved_remotes } from './internal/mf-vite-etl/load_resolved_remotes';
import type { ZephyrInternalOptions } from './internal/types/zephyr-internal-options';

export type ModuleFederationOptions = Parameters<typeof federation>[0];

interface VitePluginZephyrOptions {
  mfConfig?: ModuleFederationOptions;
  hooks?: ZephyrBuildHooks;
}

export function withZephyr(_options?: VitePluginZephyrOptions): Plugin[] {
  const mfConfig = _options?.mfConfig;
  const hooks = _options?.hooks;
  const plugins: Plugin[] = [];
  if (mfConfig) {
    plugins.push(...(federation(mfConfig) as Plugin[]));
  }
  plugins.push(zephyrPlugin(hooks));
  return plugins;
}

function zephyrPlugin(hooks?: ZephyrBuildHooks): Plugin {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

  let resolve_vite_internal_options: (value: ZephyrInternalOptions) => void;
  const vite_internal_options_defer = new Promise<ZephyrInternalOptions>((resolve) => {
    resolve_vite_internal_options = resolve;
  });
  let root: string;

  let baseHref = '/';
  let mfPlugin: (Plugin & { _options: ModuleFederationOptions }) | undefined;
  let cachedSpecifier: string | undefined;

  return {
    name: 'with-zephyr',
    // Run before Vite's env replacement so we can rewrite import.meta.env.ZE_PUBLIC_*
    enforce: 'pre',

    configResolved: async (config: ResolvedConfig) => {
      root = config.root;
      baseHref = config.base || '/';

      // Initialize Zephyr engine for both serve and build
      zephyr_defer_create({
        builder: 'vite',
        context: config.root,
      });

      resolve_vite_internal_options({
        root: config.root,
        outDir: config.build?.outDir,
        publicDir: config.publicDir,
      });

      mfPlugin = extract_mf_plugin(config.plugins ?? []);

      // Load .env files into process.env so ZE_PUBLIC_* are available to the agent
      try {
        const loaded = loadEnv(config.mode || 'production', root, '');
        for (const [k, v] of Object.entries(loaded)) {
          if (k.startsWith('ZE_PUBLIC_') && typeof v === 'string') {
            if (!(k in process.env)) process.env[k] = v;
          }
        }
      } catch {
        // ignore if loadEnv unavailable
      }
    },

    resolveId: async (source) => {
      try {
        const zephyr_engine = await zephyr_engine_defer;
        if (!cachedSpecifier) {
          const appUid = zephyr_engine.application_uid;
          cachedSpecifier = `env:vars:${appUid}`;
        }
        if (source === cachedSpecifier) {
          // In dev mode, use a virtual module; in build mode, mark as external
          if (process.env['NODE_ENV'] === 'development') {
            const appUid = zephyr_engine.application_uid;
            return { id: `\0virtual:zephyr-env-${appUid}` };
          } else {
            // Mark this as external so it gets resolved by the import map at runtime
            return { id: source, external: true };
          }
        }
      } catch {
        // ignore
      }
      return null;
    },
    transform: {
      // Hook filter for Rolldown/Vite 7 performance optimization
      // Only process Module Federation virtual remote entry files
      filter: {
        id: /virtual:mf-REMOTE_ENTRY_ID/,
      },
      handler: async (code, id) => {
        try {
          // Additional check for backward compatibility with older Vite/Rollup versions
          if (id.includes('virtual:mf-REMOTE_ENTRY_ID') && mfPlugin) {
            const dependencyPairs = extract_remotes_dependencies(root, mfPlugin._options);
            if (!dependencyPairs) {
              return code;
            }
            const zephyr_engine = await zephyr_engine_defer;
            const resolved_remotes =
              await zephyr_engine.resolve_remote_dependencies(dependencyPairs);
            if (!resolved_remotes) {
              return code;
            }
            const result = load_resolved_remotes(resolved_remotes, code);
            return result;
          }

          if (/\.(mjs|cjs|js|ts|jsx|tsx)$/.test(id) && !id.includes('node_modules')) {
            const zephyr_engine = await zephyr_engine_defer;
            if (!cachedSpecifier) {
              const appUid = zephyr_engine.application_uid;
              cachedSpecifier = `env:vars:${appUid}`;
            }
            const res = rewriteEnvReadsToVirtualModule(String(code), cachedSpecifier);
            if (res && typeof res.code === 'string' && res.code !== code) {
              code = res.code;
            }
          }

          return code;
        } catch (error) {
          handleGlobalError(error);
          // returns the original code in case of error
          return code;
        }
      },
    },
    generateBundle: async function (options, bundle) {
      // Process remoteEntry.js to inject runtime plugin
      if (mfPlugin) {
        for (const [fileName, chunk] of Object.entries(bundle)) {
          if (
            fileName === 'remoteEntry.js' &&
            chunk &&
            typeof chunk === 'object' &&
            'type' in chunk &&
            chunk.type === 'chunk' &&
            'code' in chunk
          ) {
            try {
              const dependencyPairs = extract_remotes_dependencies(
                root,
                mfPlugin._options
              );
              if (!dependencyPairs) {
                continue;
              }
              const zephyr_engine = await zephyr_engine_defer;
              const resolved_remotes =
                await zephyr_engine.resolve_remote_dependencies(dependencyPairs);
              if (!resolved_remotes) {
                continue;
              }
              const result = load_resolved_remotes(resolved_remotes, chunk.code);
              chunk.code = result;
            } catch (error) {
              handleGlobalError(error);
            }
          }
        }
      }

      // Ensure import assertions are preserved in the final bundle
      if (cachedSpecifier) {
        for (const [, chunk] of Object.entries(bundle)) {
          if (
            chunk &&
            typeof chunk === 'object' &&
            'type' in chunk &&
            chunk.type === 'chunk' &&
            'code' in chunk
          ) {
            // Replace imports without assertions with imports that have assertions
            const importWithoutAssertion = new RegExp(
              `import\\s+([^\\s]+)\\s+from\\s*['"]${cachedSpecifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
              'g'
            );

            if (chunk.code.match(importWithoutAssertion)) {
              chunk.code = chunk.code.replace(
                importWithoutAssertion,
                `import $1 from '${cachedSpecifier}' with { type: 'json' }`
              );
            }
          }
        }
      }

      // Generate the zephyr manifest
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
        // Fallback to empty manifest if there's an error
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
    // For dev server mode - serve env module and upload when server starts
    configureServer: async (server) => {
      // Add route to serve zephyr-manifest.json with correct MIME type
      server.middlewares.use((req, res, next) => {
        if (req.url === '/zephyr-manifest.json') {
          void (async () => {
            try {
              const zephyr_engine = await zephyr_engine_defer;
              const dependencies = zephyr_engine.federated_dependencies || [];

              // Use the same function as other plugins to ensure consistency
              const manifestContent = createManifestContent(dependencies, true);

              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(manifestContent);
            } catch {
              // Fallback to empty manifest if there's an error
              const fallbackManifest = JSON.stringify(
                {
                  version: '1.0.0',
                  timestamp: new Date().toISOString(),
                  dependencies: {},
                  zeVars: {},
                },
                null,
                2
              );
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(fallbackManifest);
            }
          })();
        } else {
          next();
        }
      });

      // Upload dev build
      try {
        const [vite_internal_options, zephyr_engine] = await Promise.all([
          vite_internal_options_defer,
          zephyr_engine_defer,
        ]);

        zephyr_engine.buildProperties.baseHref = baseHref;

        await zephyr_engine.start_new_build();
        const assetsMap = await extract_vite_assets_map(
          zephyr_engine,
          vite_internal_options
        );
        await zephyr_engine.upload_assets({
          assetsMap,
          buildStats: await zeBuildDashData(zephyr_engine),
          hooks,
        });
        await zephyr_engine.build_finished();
      } catch (error) {
        handleGlobalError(error);
      }
    },
    // Inject import map into HTML
    transformIndexHtml: async (html) => {
      try {
        const zephyr_engine = await zephyr_engine_defer;
        const appUid = zephyr_engine.application_uid;

        // Convert federated dependencies to remotes format
        const remotes: RemoteEntry[] =
          zephyr_engine.federated_dependencies?.map((dep) => ({
            name: dep.name,
            application_uid: dep.application_uid,
            remote_entry_url: dep.default_url,
          })) || [];

        // Use the same import map creation as Rspack plugin
        const importMap = buildEnvImportMap(appUid, remotes);
        const importMapScript = `<script type="importmap">${JSON.stringify({ imports: importMap }, null, 2)}</script>`;

        // Check if import map already exists
        if (!html.includes('type="importmap"')) {
          // Inject import map before closing head tag
          html = html.replace('</head>', `  ${importMapScript}\n</head>`);
        }

        return html;
      } catch (error) {
        handleGlobalError(error);
        return html;
      }
    },
    // For production builds
    closeBundle: async () => {
      try {
        const [vite_internal_options, zephyr_engine] = await Promise.all([
          vite_internal_options_defer,
          zephyr_engine_defer,
        ]);

        zephyr_engine.buildProperties.baseHref = baseHref;

        await zephyr_engine.start_new_build();
        const assetsMap = await extract_vite_assets_map(
          zephyr_engine,
          vite_internal_options
        );
        const modules = Object.entries(mfPlugin?._options.exposes ?? {})
          .map(([name, file]) => ({
            name: name.replace('./', ''),
            file: typeof file === 'string' ? file : file.import,
          }))
          .map(({ name, file }) => ({
            id: name,
            applicationID: `${name}:${name}`,
            requires: [],
            name,
            file,
          }));
        const buildStats = await zeBuildDashData(zephyr_engine);
        buildStats.modules = modules;
        await zephyr_engine.upload_assets({
          assetsMap,
          buildStats,
          hooks,
        });
        await zephyr_engine.build_finished();
      } catch (error) {
        handleGlobalError(error);
      }
    },
  };
}
