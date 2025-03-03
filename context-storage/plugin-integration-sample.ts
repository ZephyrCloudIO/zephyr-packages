/**
 * Plugin Integration Sample for Remote Entry Structure Sharing
 * 
 * This file demonstrates how to integrate the Remote Entry Structure Sharing
 * functionality with various bundler plugins (Webpack, Rspack, Vite, etc.).
 */

import { RemoteStructureSharingIntegration } from './remote-entry-structure-sharing-skeleton';

/**
 * Integration with Webpack/Rspack Plugin
 */
export function enhanceWebpackPlugin(options: any) {
  return {
    name: 'ZephyrWebpackPlugin',
    
    /**
     * Apply method called by webpack
     */
    apply(compiler: any) {
      // Run the original plugin
      if (options.originalPlugin) {
        options.originalPlugin.apply(compiler);
      }
      
      // Get package.json
      const packageJson = options.packageJson || require(process.cwd() + '/package.json');
      
      // Setup publisher plugin for remote applications
      if (options.isRemote) {
        compiler.options = RemoteStructureSharingIntegration.setupBundlerPlugin(
          compiler.options,
          packageJson
        );
      }
      // Setup consumer plugin for host applications
      else if (options.isHost) {
        compiler.options = RemoteStructureSharingIntegration.setupConsumerPlugin(
          compiler.options
        );
      }
      
      // Log configuration
      if (options.verbose) {
        compiler.hooks.afterEnvironment.tap('ZephyrWebpackPlugin', () => {
          console.log('Zephyr Remote Entry Structure Sharing enabled');
          console.log(`Mode: ${options.isRemote ? 'Remote' : options.isHost ? 'Host' : 'Unknown'}`);
        });
      }
    }
  };
}

/**
 * Integration with Vite Plugin
 */
export function enhanceVitePlugin(options: any) {
  return {
    name: 'zephyr-vite-plugin',
    
    /**
     * Configuration hook
     */
    config(config: any) {
      // Get package.json
      const packageJson = options.packageJson || require(process.cwd() + '/package.json');
      
      // Setup publisher plugin for remote applications
      if (options.isRemote) {
        return RemoteStructureSharingIntegration.setupBundlerPlugin(
          config,
          packageJson
        );
      }
      
      return config;
    },
    
    /**
     * Logging
     */
    buildStart() {
      if (options.verbose) {
        console.log('Zephyr Remote Entry Structure Sharing enabled');
        console.log(`Mode: ${options.isRemote ? 'Remote' : options.isHost ? 'Host' : 'Unknown'}`);
      }
    }
  };
}

/**
 * Integration with Next.js Plugin
 */
export function withZephyrRemoteSharing(nextConfig: any = {}) {
  return {
    ...nextConfig,
    
    webpack: (config: any, options: any) => {
      // Check if we're a remote or host
      const isRemote = !!config.plugins?.some((p: any) => 
        p?.constructor?.name === 'ModuleFederationPlugin' && p?._options?.exposes
      );
      
      const isHost = !!config.plugins?.some((p: any) => 
        p?.constructor?.name === 'ModuleFederationPlugin' && p?._options?.remotes
      );
      
      // Get package.json
      const packageJson = require(process.cwd() + '/package.json');
      
      // Setup appropriate plugins
      if (isRemote) {
        config = RemoteStructureSharingIntegration.setupBundlerPlugin(
          config,
          packageJson
        );
      } else if (isHost) {
        config = RemoteStructureSharingIntegration.setupConsumerPlugin(
          config
        );
      }
      
      // Call the original webpack function if provided
      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, options);
      }
      
      return config;
    }
  };
}

/**
 * Integration with Rspack Plugin
 */
export function withZephyrRspack(options: any = {}) {
  return (rspackConfig: any) => {
    // Check if we're a remote or host
    const isRemote = !!rspackConfig.plugins?.some((p: any) => 
      p?.constructor?.name === 'ModuleFederationPlugin' && p?._options?.exposes
    );
    
    const isHost = !!rspackConfig.plugins?.some((p: any) => 
      p?.constructor?.name === 'ModuleFederationPlugin' && p?._options?.remotes
    );
    
    // Get package.json
    const packageJson = options.packageJson || require(process.cwd() + '/package.json');
    
    // Setup appropriate plugins
    if (isRemote) {
      rspackConfig = RemoteStructureSharingIntegration.setupBundlerPlugin(
        rspackConfig,
        packageJson
      );
    } else if (isHost) {
      rspackConfig = RemoteStructureSharingIntegration.setupConsumerPlugin(
        rspackConfig
      );
    }
    
    // Apply any additional transformations
    if (options.transform && typeof options.transform === 'function') {
      return options.transform(rspackConfig);
    }
    
    return rspackConfig;
  };
}

/**
 * Usage examples
 */

/**
 * Example 1: Webpack Plugin Integration
 */
/*
// webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;
const { enhanceWebpackPlugin } = require('@zephyr/remote-metadata');

module.exports = {
  // ... webpack config
  plugins: [
    new ModuleFederationPlugin({
      name: 'remote',
      filename: 'remoteEntry.js',
      exposes: {
        './Button': './src/components/Button'
      }
    }),
    enhanceWebpackPlugin({
      isRemote: true,
      verbose: true
    })
  ]
};
*/

/**
 * Example 2: Vite Plugin Integration
 */
/*
// vite.config.js
import { defineConfig } from 'vite';
import federation from '@module-federation/vite';
import { enhanceVitePlugin } from '@zephyr/remote-metadata';

export default defineConfig({
  plugins: [
    federation({
      name: 'remote',
      filename: 'remoteEntry.js',
      exposes: {
        './Button': './src/components/Button'
      }
    }),
    enhanceVitePlugin({
      isRemote: true
    })
  ]
});
*/

/**
 * Example 3: Next.js Integration
 */
/*
// next.config.js
const { withZephyrRemoteSharing } = require('@zephyr/remote-metadata');

module.exports = withZephyrRemoteSharing({
  // ... next.js config
});
*/

/**
 * Example 4: Rspack Integration
 */
/*
// rspack.config.js
const { withZephyrRspack } = require('@zephyr/remote-metadata');

module.exports = withZephyrRspack({
  verbose: true
})({
  // ... rspack config
});
*/