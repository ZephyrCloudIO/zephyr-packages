import { federation } from '@module-federation/vite';
import type { PreRenderedAsset } from 'rollup';
import type { Plugin, ResolvedConfig } from 'vite';
import {
  type DeferredZephyrPrelude,
  ZephyrEngine,
  type ZephyrEnginePrelude,
  ZephyrError,
  createTemporaryVariablesFile,
  findAndReplaceVariables,
  logFn,
  zeBuildDashData,
} from 'zephyr-agent';
import { type SnapshotVariables, deferred } from 'zephyr-edge-contract';
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
    plugins.push(...(federation(mfConfig) as Plugin[]));
  }
  const [variables_defer, resolve_variables] = deferred<SnapshotVariables | undefined>();
  const prelude_defer = ZephyrEngine.create_prelude_defer();

  plugins.push(zephyrEnvsPlugin(resolve_variables, prelude_defer));
  plugins.push(zephyrPlugin(variables_defer, prelude_defer));

  return plugins;
}

// env parsing must run before vite, that's why we use a different plugin
function zephyrEnvsPlugin(
  resolve_variables: (vars?: SnapshotVariables) => void,
  { prelude_defer, prelude_defer_create }: DeferredZephyrPrelude
): Plugin {
  const variablesSet = new Set<string>();
  let zeEnvsFilename: string;

  return {
    name: 'with-zephyr-envs',
    enforce: 'pre',

    // No need to handle
    configResolved: (config) => {
      prelude_defer_create(config.root);
    },

    transform: (code) => {
      return findAndReplaceVariables(code, variablesSet, ['importMetaEnv']);
    },

    generateBundle: {
      order: 'post',
      handler: async (opts, bundle) => {
        if (variablesSet.size === 0) {
          resolve_variables(undefined);
          return;
        }

        try {
          const prelude = await prelude_defer;

          // Wasn't able to get basic data...
          if (!prelude) {
            return;
          }

          const { source, hash } = await createTemporaryVariablesFile(
            variablesSet,
            prelude.application_uid
          );

          const asset: PreRenderedAsset = {
            type: 'asset',
            source,

            // No names because this is a 100% generated file
            names: [],
            originalFileNames: [],

            // deprecated
            name: undefined,
            originalFileName: null,
          };

          // Adapted from https://github.com/rollup/rollup/blob/7536ffb3149ad4aa7cda4e7ef343e5376e2392e1/src/utils/FileEmitter.ts#L566
          zeEnvsFilename =
            typeof opts.assetFileNames === 'function'
              ? opts.assetFileNames(asset)
              : opts.assetFileNames
                  .replace('[ext]', 'js')
                  .replace('[name]', 'ze-envs')
                  .replace('[hash]', hash);

          bundle[zeEnvsFilename] = {
            ...asset,
            fileName: zeEnvsFilename,
            needsCodeReference: false,
          };

          resolve_variables({
            filename: zeEnvsFilename,
            uses: Array.from(variablesSet),
          });
        } catch (error) {
          logFn('error', ZephyrError.format(error));
          resolve_variables(undefined);
        }
      },
    },

    transformIndexHtml: async (html) => {
      if (variablesSet.size === 0) {
        return;
      }

      return {
        html,
        tags: [
          {
            tag: 'script',
            attrs: { src: `/${zeEnvsFilename}`, fetchpriority: 'high' },
            injectTo: 'head-prepend',
          },
        ],
      };
    },
  };
}

function zephyrPlugin(
  variables_defer: Promise<SnapshotVariables | undefined>,
  { prelude_defer }: DeferredZephyrPrelude
): Plugin {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

  const [vite_internal_options_defer, resolve_vite_internal_options] =
    deferred<ZephyrInternalOptions>();
  let root: string;

  return {
    name: 'with-zephyr',
    enforce: 'post',

    configResolved: async (config: ResolvedConfig) => {
      root = config.root;
      zephyr_defer_create(
        {
          builder: 'vite',
          context: config.root,
        },
        await prelude_defer
      );
      resolve_vite_internal_options({
        root: config.root,
        outDir: config.build?.outDir,
        publicDir: config.publicDir,
      });
    },
    transform: async (code, id) => {
      try {
        const dependencyPairs = extract_remotes_dependencies(root, code, id);
        if (!dependencyPairs) return code;

        const zephyr_engine = await zephyr_engine_defer;
        const resolved_remotes =
          await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

        console.log(resolved_remotes);

        if (!resolved_remotes) return code;

        return load_resolved_remotes(resolved_remotes, code, id);
      } catch (error) {
        logFn('error', ZephyrError.format(error));
        // returns the original code in case of error
        return code;
      }
    },

    closeBundle: async () => {
      try {
        const [vite_internal_options, zephyr_engine, variables] = await Promise.all([
          vite_internal_options_defer,
          zephyr_engine_defer,
          variables_defer,
        ]);

        await zephyr_engine.start_new_build();
        const assetsMap = await extract_vite_assets_map(
          zephyr_engine,
          vite_internal_options
        );

        await zephyr_engine.upload_assets({
          variables,
          assetsMap,
          buildStats: await zeBuildDashData(zephyr_engine),
        });
        await zephyr_engine.build_finished();
      } catch (error) {
        logFn('error', ZephyrError.format(error));
      }
    },
  };
}
