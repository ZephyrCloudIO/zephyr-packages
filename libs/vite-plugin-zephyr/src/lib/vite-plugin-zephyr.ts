import { federation } from '@module-federation/vite';
import {
  DeferredZephyrEngine,
  ZephyrEnginePrelude,
} from 'libs/zephyr-agent/src/zephyr-engine';
import type { Plugin, ResolvedConfig } from 'vite';
import {
  createLocalVariablesRecord,
  findAndReplaceVariables,
  logFn,
  zeBuildDashData,
  ZephyrEngine,
  ZephyrError,
} from 'zephyr-agent';
import { createZephyrRuntimeFile, ZephyrRuntimeConstants } from 'zephyr-edge-contract';
import { extract_mf_plugin } from './internal/extract/extract_mf_plugin';
import { extract_vite_assets_map } from './internal/extract/extract_vite_assets_map';
import { extract_remotes_dependencies } from './internal/mf-vite-etl/extract-mf-vite-remotes';
import { load_resolved_remotes } from './internal/mf-vite-etl/load_resolved_remotes';
import type { ZephyrInternalOptions } from './internal/types/zephyr-internal-options';

export type ModuleFederationOptions = Parameters<typeof federation>[0];

export interface VitePluginZephyrOptions {
  mfConfig?: ModuleFederationOptions;
}

interface ZephyrPluginContext extends DeferredZephyrEngine {
  usedEnvNames: Set<string>;
  prelude: ZephyrEnginePrelude | undefined;
  hasZephyrRuntime: boolean;
}

export function withZephyr(options?: VitePluginZephyrOptions): Plugin[] {
  const context: ZephyrPluginContext = {
    ...ZephyrEngine.defer_create(),
    usedEnvNames: new Set<string>(),
    prelude: undefined,
    hasZephyrRuntime: false,
  };

  return [
    options?.mfConfig ? federation(options.mfConfig) : undefined,
    zephyrPluginPre(context),
    zephyrPlugin(context),
  ]
    .flat()
    .filter((x): x is NonNullable<typeof x> => !!x);
}

function zephyrPluginPre(context: ZephyrPluginContext): Plugin {
  return {
    name: 'with-zephyr-envs',
    enforce: 'pre',

    async configResolved(config) {
      context.prelude = await ZephyrEngine.create_prelude(config.root);
    },

    transform(code) {
      if (!context.prelude) return;

      return findAndReplaceVariables(
        code,
        context.prelude.application_uid,
        context.usedEnvNames,
        ['importMetaEnv']
      );
    },
  };
}

function zephyrPlugin(context: ZephyrPluginContext): Plugin {
  let resolve_vite_internal_options: (value: ZephyrInternalOptions) => void;
  const vite_internal_options_defer = new Promise<ZephyrInternalOptions>((resolve) => {
    resolve_vite_internal_options = resolve;
  });

  let root: string;
  let baseHref = '/';
  let mfPlugin: (Plugin & { _options: ModuleFederationOptions }) | undefined;

  return {
    name: 'with-zephyr',
    enforce: 'post',

    configResolved(config: ResolvedConfig) {
      root = config.root;
      baseHref = config.base || '/';

      if (config.command !== 'build') {
        return;
      }

      context.zephyr_defer_create(
        {
          builder: 'vite',
          context: config.root,
        },
        context.prelude
      );

      resolve_vite_internal_options({
        root: config.root,
        outDir: config.build?.outDir,
        publicDir: config.publicDir,
      });

      mfPlugin = extract_mf_plugin(config.plugins ?? []);
    },

    transform: async (code, id) => {
      try {
        if (!id.includes('virtual:mf-REMOTE_ENTRY_ID') || !mfPlugin) return code;

        const dependencyPairs = extract_remotes_dependencies(root, mfPlugin._options);
        if (!dependencyPairs) return code;

        const zephyr_engine = await context.zephyr_engine_defer;
        const resolved_remotes =
          await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

        if (!resolved_remotes) return code;

        return load_resolved_remotes(resolved_remotes, code);
      } catch (error) {
        logFn('error', ZephyrError.format(error));
        // returns the original code in case of error
        return code;
      }
    },

    async generateBundle(_, bundle) {
      try {
        const { application_uid, federated_dependencies } =
          await context.zephyr_engine_defer;

        const variablesRecord = await createLocalVariablesRecord(
          context.usedEnvNames,
          application_uid,
          federated_dependencies?.map((f) => f.application_uid) || [],
          process.env
        );

        // TODO: Code to handle dependenciesRecord
        const dependenciesRecord = null;

        const source = createZephyrRuntimeFile(variablesRecord, dependenciesRecord);

        // Only creating a zephyr-runtime.js file implicates that if a build
        // without any variables is published, but later Zephyr Edge/Cloud tries
        // to use something that requires the runtime, like adding a new remote
        // or adding a new variable, it won't work. However this is not a problem
        // since, for now, both adding a new variable or adding a remote needs to deploy
        // the application again.
        if (source === null) {
          return;
        }

        context.hasZephyrRuntime = true;
        bundle[ZephyrRuntimeConstants.filename] = {
          type: 'asset',
          source,
          fileName: ZephyrRuntimeConstants.filename,
          needsCodeReference: false,

          // No names because this is a 100% generated file
          names: [],
          originalFileNames: [],

          // deprecated
          name: undefined,
          originalFileName: null,
        };
      } catch (error) {
        logFn('error', ZephyrError.format(error));
      }
    },

    transformIndexHtml: async (html) => {
      // No variables set, no need to inject the script
      if (!context.hasZephyrRuntime) {
        return;
      }

      return {
        html,
        tags: [
          {
            tag: 'script',
            attrs: { src: `/${ZephyrRuntimeConstants.filename}`, fetchpriority: 'high' },
            injectTo: 'head-prepend',
          },
        ],
      };
    },

    closeBundle: async () => {
      try {
        const [vite_internal_options, zephyr_engine] = await Promise.all([
          vite_internal_options_defer,
          context.zephyr_engine_defer,
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
          variables: context.usedEnvNames.size
            ? {
                filename: zeEnvsFilename,
                uses: Array.from(context.usedEnvNames),
              }
            : undefined,
        });
        await zephyr_engine.build_finished();
      } catch (error) {
        logFn('error', ZephyrError.format(error));
      }
    },
  };
}
