import { federation } from '@module-federation/vite';
import { loadEnv, type Plugin, type ResolvedConfig } from 'vite';
import {
  buildEnvImportMap,
  catchAsync,
  createManifestContent,
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
      await catchAsync(async () => {
        const loaded = loadEnv(config.mode || 'production', root, '');
        for (const [k, v] of Object.entries(loaded)) {
          if (k.startsWith('ZE_PUBLIC_') && typeof v === 'string') {
            if (!(k in process.env)) process.env[k] = v;
          }
        }
      });
    },

    resolveId: async (source) => {
      return await catchAsync(async () => {
        const zephyr_engine = await zephyr_engine_defer;
        if (!cachedSpecifier) {
          const appUid = zephyr_engine.application_uid;
          cachedSpecifier = `env:vars:${appUid}`;
        }
        if (source === cachedSpecifier) {
          if (process.env['NODE_ENV'] === 'development') {
            const appUid = zephyr_engine.application_uid;
            return { id: `\0virtual:zephyr-env-${appUid}` };
          } else {
            return { id: source, external: true };
          }
        }
        return null;
      }, null);
    },
    transform: {
      // Hook filter for Rolldown/Vite 7 performance optimization
      // Only process Module Federation virtual remote entry files
      filter: {
        id: /virtual:mf-REMOTE_ENTRY_ID/,
      },
      handler: async (code, id) => {
        return await catchAsync(async () => {
          if (id.includes('virtual:mf-REMOTE_ENTRY_ID') && mfPlugin) {
            const dependencyPairs = extract_remotes_dependencies(root, mfPlugin._options);
            if (!dependencyPairs) return code;

            const zephyr_engine = await zephyr_engine_defer;
            const resolved_remotes =
              await zephyr_engine.resolve_remote_dependencies(dependencyPairs);
            if (!resolved_remotes) return code;

            return load_resolved_remotes(resolved_remotes, code);
          }

          if (/\.(mjs|cjs|js|ts|jsx|tsx)$/.test(id) && !id.includes('node_modules')) {
            const zephyr_engine = await zephyr_engine_defer;
            if (!cachedSpecifier) {
              const appUid = zephyr_engine.application_uid;
              cachedSpecifier = `env:vars:${appUid}`;
            }
            const res = rewriteEnvReadsToVirtualModule(String(code), cachedSpecifier);
            if (res && typeof res.code === 'string' && res.code !== code) {
              return res.code;
            }
          }

          return code;
        }, code);
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
            await catchAsync(async () => {
              if (!mfPlugin) return;

              const dependencyPairs = extract_remotes_dependencies(
                root,
                mfPlugin._options
              );
              if (!dependencyPairs) return;

              const zephyr_engine = await zephyr_engine_defer;
              const resolved_remotes =
                await zephyr_engine.resolve_remote_dependencies(dependencyPairs);
              if (!resolved_remotes) return;

              const result = load_resolved_remotes(resolved_remotes, chunk.code);
              chunk.code = result;
            });
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

      const manifestContent = await catchAsync(async () => {
        const zephyr_engine = await zephyr_engine_defer;
        const dependencies = zephyr_engine.federated_dependencies || [];
        return createManifestContent(dependencies, true);
      }, fallbackManifest);

      this.emitFile({
        type: 'asset',
        fileName: 'zephyr-manifest.json',
        source: manifestContent,
      });
    },
    // For dev server mode - serve env module and upload when server starts
    configureServer: async (server) => {
      // Add route to serve zephyr-manifest.json with correct MIME type
      server.middlewares.use((req, res, next) => {
        if (req.url === '/zephyr-manifest.json') {
          void (async () => {
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

            const manifestContent = await catchAsync(async () => {
              const zephyr_engine = await zephyr_engine_defer;
              const dependencies = zephyr_engine.federated_dependencies || [];
              return createManifestContent(dependencies, true);
            }, fallbackManifest);

            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(manifestContent);
          })();
        } else {
          next();
        }
      });

      // Upload dev build
      await catchAsync(async () => {
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
      });
    },
    // Inject import map into HTML
    transformIndexHtml: async (html) => {
      return await catchAsync(async () => {
        const zephyr_engine = await zephyr_engine_defer;
        const appUid = zephyr_engine.application_uid;

        const remotes: RemoteEntry[] =
          zephyr_engine.federated_dependencies?.map((dep) => ({
            name: dep.name,
            application_uid: dep.application_uid,
            remote_entry_url: dep.default_url,
          })) || [];

        const importMap = buildEnvImportMap(appUid, remotes);
        const importMapScript = `<script type="importmap">${JSON.stringify({ imports: importMap }, null, 2)}</script>`;

        if (!html.includes('type="importmap"')) {
          return html.replace('</head>', `  ${importMapScript}\n</head>`);
        }

        return html;
      }, html);
    },
    // For production builds
    closeBundle: async () => {
      await catchAsync(async () => {
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
      });
    },
  };
}
