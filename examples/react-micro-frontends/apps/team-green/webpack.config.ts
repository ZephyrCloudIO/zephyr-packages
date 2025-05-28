import { withModuleFederation } from '@nx/module-federation/webpack';
import { withReact } from '@nx/react';
import { composePlugins, withNx } from '@nx/webpack';
import { withZephyr } from 'zephyr-webpack-plugin';

const mfConfig = {
  name: 'team-green',
  exposes: {
    './GreenRecos': './src/app/team-green-recos.tsx',
  },
  // Workaround necessary until Nx upgrade.
  // TODO: https://github.com/ZephyrCloudIO/zephyr-mono/issues/109
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
module.exports = composePlugins(
  withNx(),
  withReact(),
  withModuleFederation(mfConfig, { dts: false }),
  // Workaround for incomplete resolution of https://github.com/nrwl/nx/issues/31114
  (config) => {
    if (config.optimization) {
      config.optimization.runtimeChunk = false;
    }
    return config;
  },
  withZephyr()
);
