import { withReact } from '@nx/react';
import { withModuleFederation } from '@nx/react/module-federation';
import { composePlugins, withNx } from '@nx/webpack';
import { withZephyr } from 'zephyr-webpack-plugin';

const mfConfig: Parameters<typeof withModuleFederation>[0] = {
  name: 'team_red',
  exposes: {
    './TeamRedLayout': './src/app/team-red-layout',
  },
  // Workaround necessary until Nx upgrade.
  // TODO: https://github.com/ZephyrCloudIO/zephyr-mono/issues/109
  remotes: ['team_green', 'team_blue'],
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
  withModuleFederation(mfConfig),
  withZephyr(),
  // runtimeChunk override issue. https://github.com/nrwl/nx/issues/31114
  (config) => {
    if (config.optimization) {
      config.optimization.runtimeChunk = false;
    }
    return config;
  }
);
