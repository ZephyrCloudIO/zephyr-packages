import type { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';

type ModuleFederationConfig = ConstructorParameters<typeof ModuleFederationPlugin>[0];

const reactShared = { singleton: true, requiredVersion: false } as const;

const config = {
  name: 'rspack_nx_mf_host',
  remotes: {
    rspack_nx_mf_remote: 'rspack_nx_mf_remote@http://localhost:4201/remoteEntry.js',
  },
  shared: {
    react: reactShared,
    'react-dom': reactShared,
    'react/jsx-runtime': reactShared,
    'react/jsx-dev-runtime': reactShared,
  },
  dts: false,
} satisfies ModuleFederationConfig;

export default config;
