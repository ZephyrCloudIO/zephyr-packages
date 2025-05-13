import type { Plugin, ResolvedConfig } from 'vite';
import { logFn, ZephyrEngine, ZephyrError } from 'zephyr-agent';
import type { ZephyrInternalOptions } from './internal/types/zephyr-internal-options';
import { federation } from '@module-federation/vite';
import { extract_vite_assets_map } from './internal/extract/extract_vite_assets_map';
import { extractViteBuildStats } from './internal/extract/extract_vite_build_stats';
import { extract_remotes_dependencies } from './internal/mf-vite-etl/extract-mf-vite-remotes';
import { load_resolved_remotes } from './internal/mf-vite-etl/load_resolved_remotes';

import type { OutputBundle } from 'rollup';

export type ModuleFederationOptions = Parameters<typeof federation>[0] & {
  // Support for Nx webpack module federation format
  additionalShared?: Array<{
    libraryName: string;
    sharedConfig?: {
      singleton?: boolean;
      requiredVersion?: string;
    };
  }>;
};

// Structure to track module federation references
interface VitePluginZephyrOptions {
  mfConfig?: ModuleFederationOptions;
}

export function withZephyr(_options?: VitePluginZephyrOptions): Plugin[] {
  const mfConfig = _options?.mfConfig;
  const plugins: Plugin[] = [];
  if (mfConfig) {
    plugins.push(...(federation(mfConfig) as Plugin[]));
  }
  plugins.push(zephyrPlugin(_options));
  return plugins;
}

function zephyrPlugin(_options?: VitePluginZephyrOptions): Plugin {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  // const mfConfig = _options?.mfConfig;

  let resolve_vite_internal_options: (value: ZephyrInternalOptions) => void;
  const vite_internal_options_defer = new Promise<ZephyrInternalOptions>((resolve) => {
    resolve_vite_internal_options = resolve;
  });
  let root: string;
  let outputBundle: OutputBundle | undefined;

  // // remote names from the mfConfig
  // let remoteNames: string[] = [];

  // if (mfConfig?.remotes) {
  //   remoteNames = Object.entries(mfConfig.remotes)
  //     .map(([key, remote]) => {
  //       if (typeof remote === 'string') {
  //         return key;
  //       }
  //       if (typeof remote === 'object' && 'name' in remote) {
  //         return remote.name;
  //       }
  //       return key;
  //     })
  //     .filter(Boolean);
  // }

  // ze_log('vite.remoteNames: ', remoteNames);
  // Storage for tracking discovered remote imports
  // const consumes: ApplicationConsumes[] = [];
  // const processedRemotes = new Set<string>();

  // // Track module information for AST analysis
  // const moduleSourceMap = new Map<
  //   string,
  //   {
  //     originalId: string;
  //     imports: Set<string>;
  //     dynamicImports: Set<string>;
  //     source: Set<string>;
  //   }
  // >();

  // // Helper function to process remote imports consistently across hooks
  // function processRemoteImport(importItem: {
  //   applicationID: string;
  //   name: string;
  //   usedIn: UsedIn[];
  //   consumingApplicationID?: string;
  // }) {
  //   const remoteKey = `${importItem.applicationID}/${importItem.name}`;

  //   // Get consuming application ID - if it's a remote from the mfConfig, use the remote name
  //   let consumingApplicationID = importItem.consumingApplicationID;

  //   if (!consumingApplicationID && mfConfig?.name) {
  //     consumingApplicationID = mfConfig.name;
  //   }

  //   if (!processedRemotes.has(remoteKey)) {
  //     processedRemotes.add(remoteKey);
  //     consumes.push({
  //       consumingApplicationID: consumingApplicationID || importItem.name,
  //       applicationID: importItem.applicationID,
  //       name: importItem.name,
  //       usedIn: importItem.usedIn,
  //     });
  //   } else {
  //     // If we've already seen this import, update the usedIn array
  //     const existingImport = consumes.find(
  //       (item) =>
  //         item.applicationID === importItem.applicationID && item.name === importItem.name
  //     );

  //     if (existingImport) {
  //       // Add any new usedIn locations that aren't already in the list
  //       for (const usedInItem of importItem.usedIn) {
  //         if (!existingImport.usedIn.some((u) => u.file === usedInItem.file)) {
  //           existingImport.usedIn.push(usedInItem);
  //         }
  //       }
  //     }
  //   }
  // }

  return {
    name: 'with-zephyr',
    enforce: 'post',

    configResolved: async (config: ResolvedConfig) => {
      root = config.root;
      zephyr_defer_create({
        builder: 'vite',
        context: config.root,
      });
      resolve_vite_internal_options({
        root: config.root,
        outDir: config.build?.outDir,
        publicDir: config.publicDir,
      });
    },
    // moduleParsed: async ({
    //   id,
    //   ast,
    //   code,
    //   dynamicallyImportedIds,
    //   isEntry,
    //   isExternal,
    // }) => {
    //   // Initialize the module info if it doesn't exist
    //   if (!moduleSourceMap.has(id)) {
    //     moduleSourceMap.set(id, {
    //       originalId: id,
    //       imports: new Set(),
    //       dynamicImports: new Set(),
    //       source: new Set(),
    //     });
    //   }

    //   const moduleInfo = moduleSourceMap.get(id) as {
    //     originalId: string;
    //     imports: Set<string>;
    //     dynamicImports: Set<string>;
    //     source: Set<string>;
    //   };

    //   // Track static imports
    //   if (ast?.body) {
    //     for (const content of ast.body) {
    //       if (content.type === 'ImportDeclaration' && content && isEntry !== true) {
    //         const importSource = content.source.raw as string;
    //         ze_log('vite.moduleParsed.id: ', id);
    //         ze_log('vite.moduleParsed.content: ', importSource);
    //         ze_log('vite.moduleParsed.code: ', code);
    //         ze_log('vite.moduleParsed.isEntry: ', isEntry);
    //         ze_log('vite.moduleParsed.isExternal: ', isExternal);
    //         ze_log('vite.moduleParsed.dynamicallyImportedIds: ', dynamicallyImportedIds);
    //         if (code) {
    //           moduleInfo.source.add(code);
    //         }
    //         moduleInfo.imports.add(importSource);
    //         // Check if this is a Module Federation remote import (e.g., "remote-name/component-name")
    //         const match = /^["']([^\/]+)\/([^\/]+)["']$/.exec(importSource);
    //         if (match) {
    //           const remoteName = match[1];
    //           const componentName = match[2];
    //           ze_log('vite.moduleParsed.match: ', { remoteName, componentName });

    //           // Only process remotes that make sense in a Module Federation context

    //           for (const remote of remoteNames) {
    //             if (remoteName === remote) {
    //               ze_log('Found MF static import in moduleParsed', {
    //                 remoteName,
    //                 componentName,
    //                 id,
    //               });

    //               // Create a consistent usedIn entry
    //               const usedIn = [
    //                 {
    //                   file: id,
    //                   url: id.replace(root, ''),
    //                 },
    //               ];

    //               ze_log('vite.moduleParsed.processRemoteImport: ', {
    //                 remoteName,
    //                 componentName,
    //                 id,
    //               });
    //               // Process the remote import
    //               processRemoteImport({
    //                 applicationID: remoteName,
    //                 name: componentName,
    //                 consumingApplicationID: componentName,
    //                 usedIn,
    //               });
    //             }
    //           }
    //         }
    //       }
    //     }
    //   }

    //   // Extract __vitePreload imports for lazy-loaded components
    //   if (ast && code) {
    //     try {
    //       const preloadImports = extractVitePreloadImports(ast as ProgramNode, code);

    //       for (const preloadImport of preloadImports) {
    //         const { remoteId, importPath } = preloadImport;

    //         // Only process remotes that are configured in the MF config
    //         if (remoteNames.includes(remoteId)) {
    //           ze_log('Found MF lazy import via __vitePreload', {
    //             remoteId,
    //             importPath,
    //             id,
    //           });

    //           // Create a consistent usedIn entry
    //           const usedIn = [
    //             {
    //               file: id,
    //               url: id.replace(root, ''),
    //             },
    //           ];

    //           // Process the remote import
    //           processRemoteImport({
    //             applicationID: remoteId,
    //             name: importPath,
    //             consumingApplicationID: mfConfig?.name,
    //             usedIn,
    //           });
    //         }
    //       }
    //     } catch (error) {
    //       // Log but don't crash on parse errors
    //       ze_log('Error parsing __vitePreload imports', { error, id });
    //     }
    //   }
    // },

    transform: async (code, id) => {
      try {
        // Handle dependency resolution
        const dependencyPairs = extract_remotes_dependencies(root, code, id);
        if (!dependencyPairs) return code;

        const zephyr_engine = await zephyr_engine_defer;
        const resolved_remotes =
          await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

        if (!resolved_remotes) return code;

        return load_resolved_remotes(resolved_remotes, code, id);
      } catch (error) {
        logFn('error', ZephyrError.format(error));
        // returns the original code in case of error
        return code;
      }
    },
    // Capture the output bundle for build stats generation
    writeBundle: (_, bundle) => {
      outputBundle = bundle;
    },
    closeBundle: async () => {
      try {
        const [vite_internal_options, zephyr_engine] = await Promise.all([
          vite_internal_options_defer,
          zephyr_engine_defer,
        ]);

        await zephyr_engine.start_new_build();
        const assetsMap = await extract_vite_assets_map(
          zephyr_engine,
          vite_internal_options
        );

        // Generate enhanced build stats for Vite using the discovered remote imports
        const buildStats = await extractViteBuildStats({
          zephyr_engine,
          bundle: outputBundle || {},
          mfConfig: _options?.mfConfig,
          root,
        });

        // Upload assets and build stats
        await zephyr_engine.upload_assets({
          assetsMap,
          buildStats,
        });

        await zephyr_engine.build_finished();
      } catch (error) {
        logFn('error', ZephyrError.format(error));
      }
    },
  };
}
