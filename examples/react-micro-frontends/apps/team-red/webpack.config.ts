import { withReact } from '@nx/react';
import { withModuleFederation } from '@nx/react/module-federation';
import { composePlugins, withNx } from '@nx/webpack';
import { withZephyr } from 'zephyr-webpack-plugin';

const mfConfig = {
  name: 'team-red',
  exposes: {
    './TeamRedLayout': './src/app/team-red-layout',
  },
  remotes: ['team-green', 'team-blue'],
};

// Nx plugins for webpack.
export default composePlugins(
  withNx(),
  withReact(),
  withModuleFederation(mfConfig),
  withZephyr(),
  (config) => {
    return patch_import_issue(config);
  }
);



















function patch_import_issue(config: any) {
    config.plugins
    ?.filter((plugin) => plugin?.constructor.name === 'ModuleFederationPlugin')
    ?.forEach(mfConfig => {
      Object.keys(mfConfig._options.remotes)
      .forEach(remoteName => {
        mfConfig._options.remotes[remoteName] = mfConfig._options.remotes[remoteName]
        .replace(`__import__`, `import`)
      });
    });
    return config;
}


