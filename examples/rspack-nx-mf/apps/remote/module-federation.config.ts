import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'rspack_nx_mf_remote',
  exposes: {
    './Module': './src/remote-entry.ts',
  },
  shared: (libName) => {
    const reactShared = [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ];
    if (reactShared.includes(libName)) {
      return { singleton: true };
    }
    return false;
  },
};

/**
 * Nx requires a default export of the config to allow correct resolution of the module
 * federation graph.
 */
export default config;
