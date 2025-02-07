import { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { AppTools, CliPlugin, CliPluginFuture } from '@modern-js/app-tools';
import { ZeRspackPlugin } from './ze-rspack-plugin';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import { ZephyrEngine } from 'zephyr-agent';
import { withZephyr as withZephyrRspack } from 'zephyr-rspack-plugin';

const pluginName = 'zephyr-modernjs-plugin';

const isDev = process.env['NODE_ENV'] === 'development';

export const withZephyr = (
  zephyrOptions?: ZephyrPluginOptions
): CliPlugin<AppTools<'rspack' | 'webpack'>> => ({
  name: pluginName,
  pre: ['@modern-js/plugin-module-federation-config'],

  setup: () => {
    return {
      config: () => {
        return {
          tools: {
            rspack(config, { mergeConfig }) {
              withZephyrRspack()(config).then((zephyrConfig) => {
                mergeConfig(config, zephyrConfig);
              });
            },
          },
        };
      },
    };
  },
  usePlugins: isDev ? [zephyrFixPublicPath()] : [],
});

// export const withZephyr = (
//   zephyrOptions?: ZephyrPluginOptions
// ): CliPluginFuture<AppTools<'rspack' | 'webpack'>> => ({
//   name: pluginName,
//   pre: ['@modern-js/plugin-module-federation-config'],

//   setup: (api) => {
//     // api.modifyRspackConfig(async (config, { mergeConfig }) => {
//     //   const zephyrConfig = await withZephyrRspack()(config);
//     //   console.log('zephyrConfig', zephyrConfig);

//     //   mergeConfig(zephyrConfig);
//     // });
//     api.config(() => {
//       return {
//         tools: {
//           rspack(config, { mergeConfig }) {
//             // @ts-expect-error asdfasdfasdf
//             withZephyrRspack()(config).then((zephyrConfig) => {
//               console.log('done done');
//               mergeConfig(zephyrConfig);
//             });
//           },
//         },
//       };
//     });
//   },
// });

function zephyrFixPublicPath(): CliPlugin<AppTools> {
  return {
    name: 'zephyr-publicpath-fix',
    pre: [pluginName],
    setup: async () => ({
      config: async () => ({
        tools: {
          webpack(config, { isServer }) {
            if (!isServer) {
              config.output = { ...config.output, publicPath: 'auto' };
            }
            return config;
          },
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
