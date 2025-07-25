import { withModuleFederation } from '@nx/module-federation/webpack';
import { withReact } from '@nx/react';
import { composePlugins, withNx } from '@nx/webpack';
import { withZephyr } from 'zephyr-webpack-plugin';
import { isModuleFederationPlugin } from 'zephyr-xpack-internal';

const mfConfig = {
  name: 'team-red',
  exposes: {
    './TeamRedLayout': './src/app/team-red-layout',
  },
  // Workaround necessary until Nx upgrade.
  // TODO: https://github.com/ZephyrCloudIO/zephyr-mono/issues/109
  remotes: ['team-green', 'team-blue'],
  additionalShared: [
    {
      libraryName: 'react',
      sharedConfig: { singleton: true },
    },
    {
      libraryName: 'react-dom',
      sharedConfig: { singleton: true },
    },
    {
      libraryName: 'react/jsx-runtime',
      sharedConfig: { singleton: true },
    },
    {
      libraryName: 'react/jsx-dev-runtime',
      sharedConfig: { singleton: true },
    },
  ],
};

// Nx plugins for webpack.
export default composePlugins(
  withNx(),
  withReact(),
  withModuleFederation(mfConfig, { dts: false }),
  (config) => {
    // Workaround for aliases while this issue
    // -> https://github.com/nrwl/nx/issues/31346
    // is not resolved.
    const plugin = config.plugins?.find(isModuleFederationPlugin);
    if (!plugin?._options) return config;
    if ('config' in plugin._options) return config;
    plugin._options.remotes = Object.fromEntries(
      Object.entries(plugin._options.remotes || {}).map(([name, remote]) => [
        mfConfig.remotes.find((nameAlias) => nameAlias === name.replace(/_/g, '-')),
        remote,
      ])
    );

    // Workaround for incomplete resolution of https://github.com/nrwl/nx/issues/31114
    if (config.optimization) {
      config.optimization.runtimeChunk = false;
    }

    return config;
  },
  withZephyr()
);
