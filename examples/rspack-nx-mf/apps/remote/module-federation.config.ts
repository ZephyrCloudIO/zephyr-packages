import type { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';

type ModuleFederationConfig = ConstructorParameters<typeof ModuleFederationPlugin>[0];

const reactShared = { singleton: true, requiredVersion: false } as const;

const config = {
  name: 'rspack_nx_mf_remote',
  filename: 'remoteEntry.js',
  exposes: {
    './Module': './src/remote-entry.ts',
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
