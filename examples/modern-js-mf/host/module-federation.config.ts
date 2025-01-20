import { createModuleFederationConfig } from '@module-federation/modern-js';

export default createModuleFederationConfig({
  name: 'modern-host-app',
  remotes: {
    'modern-remote-app': 'modern-remote-app@http://localhost:3051/mf-manifest.json',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
});
