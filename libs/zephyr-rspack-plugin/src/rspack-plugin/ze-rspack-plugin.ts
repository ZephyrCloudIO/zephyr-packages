import type { Compiler } from '@rspack/core';
import { HtmlRspackPlugin } from '@rspack/core';
import {
  buildEnvImportMap,
  ze_log,
  type RemoteEntry,
  type ZephyrEngine,
  type ZephyrBuildHooks,
} from 'zephyr-agent';
import type { ModuleFederationPlugin } from 'zephyr-xpack-internal';
import {
  detectAndStoreBaseHref,
  logBuildSteps,
  setupManifestEmission,
  setupZeDeploy,
} from 'zephyr-xpack-internal';

const pluginName = 'ZeRspackPlugin';

export interface ZephyrRspackInternalPluginOptions {
  zephyr_engine: ZephyrEngine;
  // rspack plugin name
  pluginName: string;
  // federated module config
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  // hacks
  wait_for_index_html?: boolean;
  // outputPath?: string;
  hooks?: ZephyrBuildHooks;
}

export class ZeRspackPlugin {
  _options: ZephyrRspackInternalPluginOptions;

  constructor(options: Omit<ZephyrRspackInternalPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);
  }

  apply(compiler: Compiler): void {
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;
    detectAndStoreBaseHref(this._options.zephyr_engine, compiler);
    logBuildSteps(this._options, compiler);
    setupManifestEmission(this._options, compiler);
    setupZeDeploy(this._options, compiler);

    // Inject import map into HTML at build time for consistent structure
    this.#injectImportMapAtBuildTime(compiler);

    // Ensure our loader runs on JS/TS to rewrite env reads to virtual module
    const rules = compiler.options?.module?.rules || [];
    rules.unshift({
      test: /\.[jt]sx?$/,
      exclude: /node_modules/,
      use: [
        {
          loader: require.resolve('./env-virtual-loader.js'),
          options: {
            specifier: `env:vars:${this._options.zephyr_engine.application_uid}`,
          },
        },
      ],
    });
    compiler.options.module = compiler.options.module || {};
    compiler.options.module.rules = rules;

    // Mark the virtual specifier external so import maps can resolve it
    const existingExternals = compiler.options?.externals;
    const PER_APP_SPECIFIER = `env:vars:${this._options.zephyr_engine.application_uid}`;
    const virtualExternal = {
      [PER_APP_SPECIFIER]: `module ${PER_APP_SPECIFIER}`,
    };
    if (!existingExternals) {
      compiler.options.externals = virtualExternal;
    } else if (Array.isArray(existingExternals)) {
      compiler.options.externals = [...existingExternals, virtualExternal];
    } else if (typeof existingExternals === 'object') {
      compiler.options.externals = {
        ...existingExternals,
        ...virtualExternal,
      };
    } // function externals not supported here; users can extend if needed
  }

  #convertFederatedDepsToRemotes(): RemoteEntry[] {
    return (
      this._options.zephyr_engine.federated_dependencies?.map((dep) => ({
        name: dep.name,
        application_uid: dep.application_uid,
        remote_entry_url: dep.default_url,
      })) || []
    );
  }

  #injectImportMapAtBuildTime(compiler: Compiler): void {
    compiler.hooks.compilation.tap(pluginName, (compilation) => {
      // Use HtmlRspackPlugin's proper hooks
      try {
        const hooks = HtmlRspackPlugin.getCompilationHooks(compilation);

        // Use afterTemplateExecution hook to modify HTML and tags
        hooks.afterTemplateExecution.tapPromise(pluginName, async (data) => {
          try {
            const appUid = this._options.zephyr_engine.application_uid;
            const remotes = this.#convertFederatedDepsToRemotes();

            // Check if import map already exists
            const hasImportMap = data.headTags.some(
              (tag: any) =>
                tag.tagName === 'script' && tag.attributes?.type === 'importmap'
            );

            if (!hasImportMap) {
              // Add import map to head tags
              data.headTags.unshift({
                tagName: 'script',
                attributes: { type: 'importmap' },
                innerHTML: JSON.stringify({
                  imports: buildEnvImportMap(appUid, remotes),
                }),
                voidTag: false,
              });
            }
          } catch (e) {
            ze_log.misc('Failed to inject import map at build time:', e);
          }

          return data;
        });
      } catch {
        // HtmlRspackPlugin might not be available if no HTML is being generated
        ze_log.misc('HtmlRspackPlugin not available, skipping import map injection');
      }
    });
  }

  // #setupDevEnvRoute(devServer: DevServer): void {
  //   const originalSetup = devServer.setupMiddlewares;
  //   devServer.setupMiddlewares = (middlewares, server) => {
  //     const app = server?.app;

  //     if (app && typeof app.get === 'function' && !app._zephyrEnvRouteAdded) {
  //       app._zephyrEnvRouteAdded = true;

  //       // Serve the zephyr-manifest.json in development
  //       app.get('/zephyr-manifest.json', (_req: Request, res: any) => {
  //         try {
  //           const envVars = collectZEPublicVars(process.env);

  //           // Generate manifest with unified structure for dev server
  //           const manifest = {
  //             version: '1.0.0',
  //             timestamp: new Date().toISOString(),
  //             dependencies: {}, // No dependencies in dev mode yet
  //             zeVars: envVars
  //           };

  //           const manifestContent = JSON.stringify(manifest, null, 2);

  //           res.setHeader('Content-Type', 'application/json; charset=utf-8');
  //           res.setHeader('Access-Control-Allow-Origin', '*');
  //           return res.end(manifestContent);
  //         } catch (_e) {
  //           res.status(500);
  //           return res.end('{"version": "1.0.0", "dependencies": {}, "zeVars": {}}');
  //         }
  //       });
  //     }

  //     return typeof originalSetup === 'function'
  //       ? originalSetup.call(devServer, middlewares, server)
  //       : middlewares;
  //   };
  // }
}
