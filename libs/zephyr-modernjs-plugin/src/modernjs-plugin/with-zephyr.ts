import * as fs from 'node:fs';
import { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { AppTools, CliPlugin } from '@modern-js/app-tools';
import { ZeRspackPlugin } from './ze-rspack-plugin';
import { zeBuildDashData, ZephyrEngine } from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import { ZephyrInternalOptions } from '../type/zephyr-internal-types';
import * as path from 'path';
import { buffer } from 'node:stream/consumers';

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

    let mfConfig: any;

    const { zephyr_defer_create, zephyr_engine_defer } = ZephyrEngine.defer_create();
    // const zephyrEngine = await ZephyrEngine.create(appContext.appDirectory);
    zephyr_defer_create(appContext.appDirectory);
    const zephyr_engine = await zephyr_engine_defer;

    return {
      beforeBuild: async ({ bundlerConfigs }) => {
        if (!bundlerConfigs || bundlerConfigs.length === 0) {
          console.warn('No bundler configurations found');
          return;
        }
        const currentBundle = bundlerConfigs[0];

        const dependencyPairs = extractFederatedDependencyPairs(currentBundle);

        const resolvedDependencies =
          await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

        mutWebpackFederatedRemotesConfig(currentBundle, resolvedDependencies);
        mfConfig = makeCopyOfModuleFederationOptions(currentBundle);

        // currentBundle.plugins?.push(
        //   new ZeRspackPlugin({
        //     zephyr_engine: zephyr_engine,
        //     mfConfig: mfConfig,
        //     wait_for_index_html: zephyrOptions?.wait_for_index_html,
        //   })
        // );
      },
      afterBuild: async ({ stats }) => {
        // path: string;
        // extname: string;
        // hash: string;
        // size: number;
        // buffer: Buffer | string;

        // TODO: upload assets
        console.log('afterBuild', stats?.toJson(0).assets);

        // const assetsMap = t.stats?.toJson(0)['map']((asset: any) => ({
        //   path: asset.path,
        //   extname: asset.extname,
        //   hash: asset.hash,
        //   size: asset.size,
        //   buffer: asset.buffer,
        // }));

        // console.log(assetsMap);

        await zephyr_engine.start_new_build();
        // await zephyr_engine.upload_assets({
        //   assetsMap: t.stats?.toJson(0),
        //   buildStats: await zeBuildDashData(zephyr_engine),
        // });
        await zephyr_engine.build_finished();
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
