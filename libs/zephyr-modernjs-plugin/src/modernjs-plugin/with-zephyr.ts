// import { ZephyrPluginOptions } from 'zephyr-edge-contract';
// import { AppTools, CliPlugin } from '@modern-js/app-tools';
// import { ZeRspackPlugin } from './ze-rspack-plugin';
// import { ZephyrEngine } from 'zephyr-agent';
// import {
//   extractFederatedDependencyPairs,
//   makeCopyOfModuleFederationOptions,
//   mutWebpackFederatedRemotesConfig,
// } from 'zephyr-xpack-internal';
// import { ZephyrInternalOptions } from '../type/zephyr-internal-types';
// import * as path from 'path';

// const pluginName = 'zephyr-modernjs-plugin';

// // 1. main plugin (combination of plugins)

// // 2. first plugin: pre runtime init - authentication, zephyr engine, mutate mf
// // 3. second plugin: pre handling SSR
// // 4. third pluign: post processing asset upload

// export const withZephyr = (
//   zephyrOptions?: ZephyrPluginOptions
// ): CliPlugin<AppTools<'rspack'>> => ({
//   name: pluginName,
//   pre: ['@modern-js/plugin-module-federation-config'],

//   setup: async ({ useAppContext }) => {
//     const appContext = useAppContext();

//     const zephyr_modern_internal_options: ZephyrInternalOptions = {
//       root: appContext.appDirectory,
//       outDir: appContext.distDirectory,
//       publicDir: path.resolve(appContext.appDirectory, 'static'),
//     };

//     const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

//     console.log('TEST ');

//     return {
//       beforeBuild: async ({ bundlerConfigs }) => {
//         console.log('TEST2');

//         if (bundlerConfigs) {
//           const currentBundle = bundlerConfigs[0];

//           const zephyr_engine = await zephyr_engine_defer;

//           const dependencyPairs = extractFederatedDependencyPairs(currentBundle);

//           const resolvedDependencies =
//             await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

//           mutWebpackFederatedRemotesConfig(currentBundle, resolvedDependencies);

//           const mfConfig = makeCopyOfModuleFederationOptions(currentBundle);

//           currentBundle.plugins?.push(
//             new ZeRspackPlugin({
//               zephyr_engine: zephyr_engine,
//               mfConfig: mfConfig,
//               wait_for_index_html: zephyrOptions?.wait_for_index_html,
//             })
//           );
//         }
//       },
//       afterBuild: ({ stats }) => {
//         // closeBundle: async () => {
//         //   const vite_internal_options = await vite_internal_options_defer;
//         //   const zephyr_engine = await zephyr_engine_defer;

//         //   await zephyr_engine.start_new_build();
//         //   const assetsMap = await extract_vite_assets_map(
//         //     zephyr_engine,
//         //     vite_internal_options
//         //   );
//         //   await zephyr_engine.upload_assets({
//         //     assetsMap,
//         //     buildStats: await zeBuildDashData(zephyr_engine),
//         //   });
//         //   await zephyr_engine.build_finished();
//         // },
//         console.log('stats', JSON.stringify(stats, null, 2));
//         console.log('TEST TEST TEST');

//         // const zephyr_engine = await zephyr_engine_defer;

//         // await zephyr_engine.start_new_build();

//         // const assets_map = await extract_modern_asset_map();
//       },
//     };
//   },

//   usePlugins: [zephyrFixPublicPath()],
// });

// function zephyrFixPublicPath(): CliPlugin<AppTools> {
//   return {
//     name: 'zephyr-publicpath-fix',
//     pre: [pluginName],
//     setup: async () => ({
//       config: async () => ({
//         tools: {
//           rspack(config, { isServer }) {
//             if (!isServer) {
//               config.output = { ...config.output, publicPath: 'auto' };
//             }
//           },
//         },
//       }),
//     }),
//   };
// }
import { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { AppTools, CliPlugin } from '@modern-js/app-tools';
import { ZeRspackPlugin } from './ze-rspack-plugin';
import { ZephyrEngine } from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import { ZephyrInternalOptions } from '../type/zephyr-internal-types';
import * as path from 'path';

const pluginName = 'zephyr-modernjs-plugin';

// 1. main plugin (combination of plugins)
// 2. first plugin: pre runtime init - authentication, zephyr engine, mutate mf
// 3. second plugin: pre handling SSR
// 4. third plugin: post processing asset upload
export const withZephyr = (
  zephyrOptions?: ZephyrPluginOptions
): CliPlugin<AppTools<'rspack'>> => ({
  name: pluginName,
  pre: ['@modern-js/plugin-module-federation-config'],

  setup: async ({ useAppContext }) => {
    const appContext = useAppContext();
    const zephyrInternalOptions: ZephyrInternalOptions = {
      root: appContext.appDirectory,
      outDir: appContext.distDirectory,
      publicDir: path.resolve(appContext.appDirectory, 'static'),
    };
    let mfConfig: any = null;

    const { zephyr_defer_create, zephyr_engine_defer } = ZephyrEngine.defer_create();
    // const zephyrEngine = await ZephyrEngine.create(appContext.appDirectory);

    return {
      beforeBuild: async ({ bundlerConfigs }) => {
        if (!bundlerConfigs || bundlerConfigs.length === 0) {
          console.warn('No bundler configurations found');
          return;
        }

        const zephyr_engine = await zephyr_engine_defer;
        zephyr_defer_create(appContext.appDirectory);

        const currentBundle = bundlerConfigs[0];

        const dependencyPairs = extractFederatedDependencyPairs(currentBundle);
        const resolvedDependencies =
          await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

        mutWebpackFederatedRemotesConfig(currentBundle, resolvedDependencies);
        mfConfig = makeCopyOfModuleFederationOptions(currentBundle);

        console.log('Finished');
      },
      afterBuild: async ({ stats }) => {
        console.log('stats', JSON.stringify(stats, null, 2));
        console.log('TEST TEST');
      },
    };
  },
  usePlugins: [zephyrFixPublicPath()],
});

function zephyrFixPublicPath(): CliPlugin<AppTools> {
  return {
    name: 'zephyr-publicpath-fix',
    pre: [pluginName],
    setup: async () => ({
      config: async () => ({
        tools: {
          rspack(config, { isServer }) {
            if (!isServer) {
              config.output = { ...config.output, publicPath: 'auto' };
            }
            return config;
          },
        },
      }),
    }),
  };
}
