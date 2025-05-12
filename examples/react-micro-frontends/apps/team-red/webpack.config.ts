import { withReact } from '@nx/react';
import { withModuleFederation } from '@nx/react/module-federation';
import { composePlugins, withNx } from '@nx/webpack';
import { withZephyr } from 'zephyr-webpack-plugin';

const mfConfig = {
  name: 'team_red',
  exposes: {
    './TeamRedLayout': './src/app/team-red-layout',
  },
  // Workaround necessary until Nx upgrade.
  // TODO: https://github.com/ZephyrCloudIO/zephyr-mono/issues/109
  remotes: ['teamgreen', 'team-blue'],
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
  withZephyr()
);
