import { federation } from '@module-federation/vite';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { loadEnv, type Plugin, type ResolvedConfig } from 'vite';
import {
  buildEnvImportMap,
  createManifestContent,
  logFn,
  rewriteEnvReadsToVirtualModule,
  zeBuildDashData,
  ZephyrEngine,
  ZephyrError,
  type RemoteEntry,
} from 'zephyr-agent';
import { extract_mf_plugin } from './internal/extract/extract_mf_plugin';
import { extract_vite_assets_map } from './internal/extract/extract_vite_assets_map';
import { extract_remotes_dependencies } from './internal/mf-vite-etl/extract-mf-vite-remotes';
import { load_resolved_remotes } from './internal/mf-vite-etl/load_resolved_remotes';
import type { ZephyrInternalOptions } from './internal/types/zephyr-internal-options';

export type ModuleFederationOptions = Parameters<typeof federation>[0];

interface VitePluginZephyrOptions {
  mfConfig?: ModuleFederationOptions;
}

export function withZephyr(_options?: VitePluginZephyrOptions): Plugin[] {
  const mfConfig = _options?.mfConfig;
  const plugins: Plugin[] = [];
  if (mfConfig) {
    // Type assertion to handle multiple vite versions in monorepo
    plugins.push(...(federation(mfConfig) as Plugin[]));
  }
  plugins.push(zephyrPlugin());
  return plugins;
}

function zephyrPlugin(): Plugin {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

  let resolve_vite_internal_options: (value: ZephyrInternalOptions) => void;
  const vite_internal_options_defer = new Promise<ZephyrInternalOptions>((resolve) => {
    resolve_vite_internal_options = resolve;
  });
  let root: string;

  let baseHref = '/';
  let mfPlugin: (Plugin & { _options: ModuleFederationOptions }) | undefined;
  let cachedSpecifier: string | undefined;
  let uploadCompleted = false;

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
          const appName = zephyr_engine.applicationProperties.name;
          cachedSpecifier = `env:vars:${appName}`;
        }
        if (source === cachedSpecifier) {
          // In dev mode, use a virtual module; in build mode, mark as external
          if (process.env['NODE_ENV'] === 'development') {
            const appName = zephyr_engine.applicationProperties.name;
            return { id: `\0virtual:zephyr-env-${appName}` };
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
              const appName = zephyr_engine.applicationProperties.name;
              cachedSpecifier = `env:vars:${appName}`;
            }
            const res = rewriteEnvReadsToVirtualModule(String(code), cachedSpecifier);
            if (res && typeof res.code === 'string' && res.code !== code) {
              code = res.code;
            }
          }

          return code;
        } catch (error) {
          logFn('error', ZephyrError.format(error));
          // returns the original code in case of error
          return code;
        }
      },
    },
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
        });
        await zephyr_engine.build_finished();
      } catch (error) {
        logFn('error', ZephyrError.format(error));
      }
    },
    buildApp: {
      handler: async function (builder) {
        if (uploadCompleted) return;

        try {
          const [vite_internal_options, zephyr_engine] = await Promise.all([
            vite_internal_options_defer,
            zephyr_engine_defer,
          ]);

          // Check if all environments are built before proceeding
          // This ensures we only run once after all builds (client, SSR, etc.) are complete
          const environments = builder.environments;
          if (environments) {
            const allBuilt = Object.values(environments).every((env) => env.isBuilt);
            if (!allBuilt) {
              // Not all environments are built yet, skip this execution
              return;
            }
          }

          let buildOptions = vite_internal_options;

          // Check if this is an environment-based build (Vite 7+)
          const clientEnv = builder.environments?.['client'];
          if (clientEnv?.isBuilt) {
            const clientOutDir = clientEnv.config.build?.outDir;
            if (clientOutDir) {
              buildOptions = {
                ...vite_internal_options,
                outDir: clientOutDir,
              };
            }
          }

          const outDir = buildOptions.outDir || 'dist';

          // Process remoteEntry.js to inject runtime plugin
          if (mfPlugin) {
            const remoteEntryPath = join(outDir, 'remoteEntry.js');
            if (existsSync(remoteEntryPath)) {
              try {
                const dependencyPairs = extract_remotes_dependencies(
                  root,
                  mfPlugin._options
                );
                if (dependencyPairs) {
                  const resolved_remotes =
                    await zephyr_engine.resolve_remote_dependencies(dependencyPairs);
                  if (resolved_remotes) {
                    let code = readFileSync(remoteEntryPath, 'utf-8');
                    code = load_resolved_remotes(resolved_remotes, code);
                    writeFileSync(remoteEntryPath, code, 'utf-8');
                  }
                }
              } catch (error) {
                logFn(
                  'error',
                  `Failed to process remoteEntry.js: ${ZephyrError.format(error)}`
                );
              }
            }
          }

          // Ensure import assertions are preserved in the final bundle
          if (cachedSpecifier) {
            try {
              const { readdirSync } = await import('fs');
              const specifier = cachedSpecifier; // Capture for closure
              const processDirectory = (dir: string) => {
                const entries = readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                  const fullPath = join(dir, entry.name);
                  if (entry.isDirectory()) {
                    processDirectory(fullPath);
                  } else if (entry.isFile() && /\.(js|mjs)$/.test(entry.name)) {
                    try {
                      let code = readFileSync(fullPath, 'utf-8');
                      const importWithoutAssertion = new RegExp(
                        `import\\s+([^\\s]+)\\s+from\\s*['"]${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
                        'g'
                      );
                      if (code.match(importWithoutAssertion)) {
                        code = code.replace(
                          importWithoutAssertion,
                          `import $1 from '${specifier}' with { type: 'json' }`
                        );
                        writeFileSync(fullPath, code, 'utf-8');
                      }
                    } catch (error) {
                      logFn(
                        'error',
                        `Failed to process ${fullPath}: ${ZephyrError.format(error)}`
                      );
                    }
                  }
                }
              };
              processDirectory(outDir);
            } catch (error) {
              logFn(
                'error',
                `Failed to process import assertions: ${ZephyrError.format(error)}`
              );
            }
          }

          // Generate the zephyr manifest
          try {
            const dependencies = zephyr_engine.federated_dependencies || [];
            const manifestContent = createManifestContent(dependencies, true);
            const manifestPath = join(outDir, 'zephyr-manifest.json');
            writeFileSync(manifestPath, manifestContent, 'utf-8');
          } catch (error) {
            logFn('error', `Failed to generate manifest: ${ZephyrError.format(error)}`);
            // Fallback to empty manifest if there's an error
            const manifestPath = join(outDir, 'zephyr-manifest.json');
            writeFileSync(
              manifestPath,
              JSON.stringify(
                {
                  version: '1.0.0',
                  timestamp: new Date().toISOString(),
                  dependencies: {},
                  zeVars: {},
                },
                null,
                2
              ),
              'utf-8'
            );
          }

          // Inject import map into index.html
          try {
            const indexPath = join(outDir, 'index.html');
            if (existsSync(indexPath)) {
              let html = readFileSync(indexPath, 'utf-8');
              const appName = zephyr_engine.applicationProperties.name;

              // Convert federated dependencies to remotes format
              const remotes: RemoteEntry[] =
                zephyr_engine.federated_dependencies?.map((dep) => ({
                  name: dep.name,
                  remote_entry_url: dep.default_url,
                })) || [];

              // Use the same import map creation as Rspack plugin
              const importMap = buildEnvImportMap(appName, remotes);
              const importMapScript = `<script type="importmap">${JSON.stringify({ imports: importMap }, null, 2)}</script>`;

              // Check if import map already exists
              if (!html.includes('type="importmap"')) {
                // Inject import map before closing head tag
                html = html.replace('</head>', `  ${importMapScript}\n</head>`);
                writeFileSync(indexPath, html, 'utf-8');
              }
            }
          } catch (error) {
            logFn('error', `Failed to inject import map: ${ZephyrError.format(error)}`);
          }

          zephyr_engine.buildProperties.baseHref = baseHref;

          logFn('info', 'Uploading assets after build...');

          await zephyr_engine.start_new_build();
          const assetsMap = await extract_vite_assets_map(zephyr_engine, buildOptions);
          await zephyr_engine.upload_assets({
            assetsMap,
            buildStats: await zeBuildDashData(zephyr_engine),
          });
          await zephyr_engine.build_finished();

          uploadCompleted = true;
        } catch (error) {
          logFn('error', ZephyrError.format(error));
        }
      },
      order: 'post',
    },
  };
}
