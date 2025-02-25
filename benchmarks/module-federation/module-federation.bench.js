import { bench, describe } from 'vitest';
import {
  mutWebpackFederatedRemotesConfig,
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
} from '../../libs/zephyr-xpack-internal/src';

describe('Module Federation Performance', () => {
  // Sample webpack config with MF plugin
  const webpackConfig = {
    context: '/sample/context',
    plugins: [
      {
        _options: {
          name: 'app1',
          filename: 'remoteEntry.js',
          exposes: {
            './Button': './src/Button',
          },
          remotes: {
            app2: 'app2@http://localhost:3002/remoteEntry.js',
            app3: 'app3@http://localhost:3003/remoteEntry.js',
          },
          shared: ['react', 'react-dom'],
        },
      },
    ],
  };

  // Sample dependencies
  const sampleDependencies = [
    { importSpecifier: 'app2', packageName: 'app2' },
    { importSpecifier: 'app3', packageName: 'app3' },
  ];

  // Sample zephyr engine
  const zephyrEngine = {
    buildProperties: {},
  };

  bench('Extract federated dependency pairs', () => {
    extractFederatedDependencyPairs(webpackConfig);
  });

  bench('Make copy of Module Federation options', () => {
    makeCopyOfModuleFederationOptions(webpackConfig);
  });

  bench('Mutate webpack federated remotes config', () => {
    mutWebpackFederatedRemotesConfig(zephyrEngine, webpackConfig, sampleDependencies);
  });
});
