import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: '@webpack-mf/shell',
  remotes: ['remote1'],
};

export default config;
