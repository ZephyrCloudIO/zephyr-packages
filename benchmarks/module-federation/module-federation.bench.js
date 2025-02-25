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
            './Header': './src/Header',
            './Footer': './src/Footer',
          },
          remotes: {
            app2: 'app2@http://localhost:3002/remoteEntry.js',
            app3: 'app3@http://localhost:3003/remoteEntry.js',
            app4: 'app4@http://localhost:3004/remoteEntry.js',
          },
          shared: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    ],
  };

  // Create large remotes object for testing
  const createLargeRemotesConfig = (count = 10) => {
    const remotes = {};
    for (let i = 0; i < count; i++) {
      remotes[`app${i}`] =
        `app${i}@http://localhost:3${i.toString().padStart(3, '0')}/remoteEntry.js`;
    }
    return {
      ...webpackConfig,
      plugins: [
        {
          _options: {
            ...webpackConfig.plugins[0]._options,
            remotes,
          },
        },
      ],
    };
  };

  // Sample dependencies
  const sampleDependencies = [
    { importSpecifier: 'app2', packageName: 'app2' },
    { importSpecifier: 'app3', packageName: 'app3' },
    { importSpecifier: 'app4', packageName: 'app4' },
  ];

  // Create large dependencies array for testing
  const createLargeDependencies = (count = 10) => {
    return Array.from({ length: count }, (_, i) => ({
      importSpecifier: `app${i}`,
      packageName: `app${i}`,
      url: `http://localhost:3${i.toString().padStart(3, '0')}/remoteEntry.js`,
    }));
  };

  // Sample zephyr engine
  const zephyrEngine = {
    buildProperties: {},
  };

  bench('Extract federated dependency pairs - small config', () => {
    extractFederatedDependencyPairs(webpackConfig);
  });

  bench('Extract federated dependency pairs - 100 remotes', () => {
    extractFederatedDependencyPairs(createLargeRemotesConfig(100));
  });

  bench('Make copy of Module Federation options - small config', () => {
    makeCopyOfModuleFederationOptions(webpackConfig);
  });

  bench('Make copy of Module Federation options - 100 remotes', () => {
    makeCopyOfModuleFederationOptions(createLargeRemotesConfig(100));
  });

  bench('Mutate webpack federated remotes config - small config', () => {
    mutWebpackFederatedRemotesConfig(zephyrEngine, webpackConfig, sampleDependencies);
  });

  bench('Mutate webpack federated remotes config - 100 remotes', () => {
    mutWebpackFederatedRemotesConfig(
      zephyrEngine,
      createLargeRemotesConfig(100),
      createLargeDependencies(100)
    );
  });

  // These functions were removed from the codebase, so we'll comment out these benchmarks
  // bench('Create remote replacement URL', () => {
  //   createRemoteReplacementUrl('app2', 'app2@http://localhost:3002/remoteEntry.js', {
  //     packageName: 'app2',
  //     importSpecifier: 'app2',
  //   });
  // });

  // bench('Get filename from URL', () => {
  //   getFileNameFromURL('http://localhost:3002/remoteEntry.js');
  // });
});
