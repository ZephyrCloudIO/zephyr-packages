/**
 * Integration Example
 * 
 * This file demonstrates how the MF 2.0 integration works with Zephyr,
 * showing the key components and their interactions.
 */

import { MFVersion, isModuleFederationPlugin, getMFVersionFromPlugin, createMFConfigExtractor } from './enhanced-plugin-detection';
import { iterateFederationConfig, extractFederatedDependencyPairs, XFederatedConfig } from './enhanced-config-extraction';
import { createMfRuntimeCode, ZeResolvedDependency, createRetryPlugin, createRuntimePluginsInitCode } from './enhanced-runtime-code-generation';
import { MF2ManifestAdapter, MF2Manifest, Snapshot } from './mf2-manifest-adapter-implementation';
import { ZephyrVersionedStorage, Feature } from './zephyr-versioning-system-implementation';
import { validateManifest, ManifestFormat } from './manifest-validation';

// Sample webpack configuration with MF 2.0 plugin
const sampleConfig = {
  context: '/sample/project',
  plugins: [
    {
      constructor: {
        name: '@module-federation/enhanced/NativeFederationPlugin'
      },
      _options: {
        name: 'host',
        filename: 'remoteEntry.js',
        remotes: [
          {
            alias: 'remote1',
            entry: 'https://example.com/remote1/mf-manifest.json',
            federationContainerName: 'remote1',
            moduleName: 'ButtonComponent'
          },
          {
            alias: 'remote2',
            entry: 'https://example.com/remote2/mf-manifest.json',
            federationContainerName: 'remote2',
            moduleName: 'CardComponent'
          }
        ],
        exposes: [
          {
            name: 'Header',
            path: './src/components/Header'
          },
          {
            name: 'Footer',
            path: './src/components/Footer'
          }
        ],
        shared: [
          {
            name: 'react',
            version: '^18.2.0',
            singleton: true,
            requiredVersion: '^18.2.0',
            eager: true
          },
          {
            name: 'react-dom',
            version: '^18.2.0',
            singleton: true,
            requiredVersion: '^18.2.0'
          }
        ],
        runtimePlugins: [
          'path/to/retry-plugin.js',
          'path/to/fallback-plugin.js'
        ]
      }
    }
  ]
};

// Sample MF 2.0 manifest
const sampleMF2Manifest: MF2Manifest = {
  id: 'host',
  name: 'host',
  metaData: {
    name: 'host',
    publicPath: 'https://example.com/host/',
    type: 'app',
    buildInfo: {
      buildVersion: '1.0.0'
    },
    remoteEntry: {
      name: 'remoteEntry.js',
      path: '',
      type: 'module'
    },
    types: {
      name: '@mf-types.d.ts',
      path: '',
      zip: '@mf-types.zip'
    },
    globalName: 'host',
    pluginVersion: '1.0.0'
  },
  remotes: [
    {
      federationContainerName: 'remote1',
      moduleName: 'ButtonComponent',
      alias: 'remote1',
      entry: 'https://example.com/remote1/mf-manifest.json'
    },
    {
      federationContainerName: 'remote2',
      moduleName: 'CardComponent',
      alias: 'remote2',
      entry: 'https://example.com/remote2/mf-manifest.json'
    }
  ],
  shared: [
    {
      id: 'host:react',
      name: 'react',
      version: '18.2.0',
      singleton: true,
      requiredVersion: '^18.2.0',
      assets: {
        js: {
          async: [],
          sync: ['31.9a8b3fdae82965b5.js']
        },
        css: {
          async: [],
          sync: []
        }
      }
    },
    {
      id: 'host:react-dom',
      name: 'react-dom',
      version: '18.2.0',
      singleton: true,
      requiredVersion: '^18.2.0',
      assets: {
        js: {
          async: ['41.943487d2ae5edc05.js'],
          sync: []
        },
        css: {
          async: [],
          sync: []
        }
      }
    }
  ],
  exposes: [
    {
      id: 'host:Header',
      name: 'Header',
      path: './src/components/Header',
      assets: {
        js: {
          sync: ['__federation_expose_Header.6c45cdda4137320d.js'],
          async: []
        },
        css: {
          sync: [],
          async: []
        }
      }
    },
    {
      id: 'host:Footer',
      name: 'Footer',
      path: './src/components/Footer',
      assets: {
        js: {
          sync: ['__federation_expose_Footer.7d45cdda4137320d.js'],
          async: []
        },
        css: {
          sync: [],
          async: []
        }
      }
    }
  ]
};

/**
 * Integration demonstration
 */
function demonstrateIntegration(): void {
  console.log('Zephyr MF 2.0 Integration Demonstration');
  console.log('======================================');

  // Step 1: Plugin Detection
  console.log('\n1. Plugin Detection:');
  const mfPlugin = sampleConfig.plugins[0];
  const isMFPlugin = isModuleFederationPlugin(mfPlugin);
  const mfVersion = getMFVersionFromPlugin(mfPlugin);
  console.log(`  Is Module Federation Plugin: ${isMFPlugin}`);
  console.log(`  Module Federation Version: ${mfVersion}`);

  // Step 2: Configuration Extraction
  console.log('\n2. Configuration Extraction:');
  const configExtractor = createMFConfigExtractor(mfPlugin);
  console.log(`  Extracted Name: ${configExtractor.extractName()}`);
  console.log(`  Remotes Count: ${Object.keys(configExtractor.extractRemotes()).length}`);
  console.log(`  Exposes Count: ${Object.keys(configExtractor.extractExposes()).length}`);
  console.log(`  Shared Count: ${Object.keys(configExtractor.extractShared()).length}`);
  console.log(`  Runtime Plugins Count: ${configExtractor.extractRuntimePlugins().length}`);

  // Step 3: Federated Configuration
  console.log('\n3. Federated Configuration:');
  iterateFederationConfig(sampleConfig, (config: XFederatedConfig) => {
    console.log(`  Configuration Name: ${config.name}`);
    console.log(`  MF Version: ${config.mfVersion}`);
    console.log(`  Has Runtime Plugins: ${Boolean(config.runtimePlugins?.length)}`);
    return config;
  });

  // Step 4: Extract Dependency Pairs
  console.log('\n4. Extract Dependency Pairs:');
  const depPairs = extractFederatedDependencyPairs(sampleConfig, (context) => ({
    zephyrDependencies: {
      'extra-remote': '1.0.0'
    }
  }));
  console.log(`  Dependency Pairs: ${JSON.stringify(depPairs)}`);

  // Step 5: Manifest Conversion
  console.log('\n5. Manifest Conversion:');
  const adapter = new MF2ManifestAdapter();
  const isValidMF2 = adapter.isValid(sampleMF2Manifest);
  console.log(`  Is Valid MF2 Manifest: ${isValidMF2}`);
  
  // Convert MF2 to Zephyr
  const zephyrSnapshot = adapter.toZephyrSnapshot(sampleMF2Manifest);
  console.log(`  Converted to Zephyr Snapshot:`);
  console.log(`    application_uid: ${zephyrSnapshot.application_uid}`);
  console.log(`    version: ${zephyrSnapshot.version}`);
  console.log(`    Assets Count: ${Object.keys(zephyrSnapshot.assets).length}`);
  
  // Convert back to MF2
  const roundTripMF2 = adapter.fromZephyrSnapshot(zephyrSnapshot);
  console.log(`  Round-trip Conversion Success: ${roundTripMF2.id === sampleMF2Manifest.id}`);

  // Step 6: Runtime Code Generation
  console.log('\n6. Runtime Code Generation:');
  const dependency: ZeResolvedDependency = {
    name: 'remote1',
    application_uid: 'remote1.example.com',
    remote_entry_url: 'https://example.com/remote1/remoteEntry.js',
    default_url: 'https://fallback.example.com/remote1/remoteEntry.js',
    library_type: 'module',
    mfVersion: MFVersion.MF2
  };
  
  const mf2RuntimeCode = createMfRuntimeCode(dependency, MFVersion.MF2);
  console.log(`  Generated MF2 Runtime Code Length: ${mf2RuntimeCode.length} characters`);
  
  // Step 7: Runtime Plugins
  console.log('\n7. Runtime Plugins:');
  const retryPlugin = createRetryPlugin({
    fetch: {
      retryTimes: 3,
      retryDelay: 500
    },
    script: {
      retryTimes: 2,
      moduleName: ['remote1', 'remote2']
    }
  });
  console.log(`  Created Retry Plugin: ${retryPlugin.name}`);
  
  const pluginsInitCode = createRuntimePluginsInitCode([retryPlugin]);
  console.log(`  Generated Plugins Init Code Length: ${pluginsInitCode.length} characters`);

  // Step 8: Versioning and Storage
  console.log('\n8. Versioning and Storage:');
  const storage = new ZephyrVersionedStorage('/tmp/zephyr');
  console.log(`  Supports MF2 Manifest: ${storage.supportsFeature(Feature.MF2_MANIFEST)}`);
  console.log(`  Supports Runtime Plugins: ${storage.supportsFeature(Feature.RUNTIME_PLUGINS)}`);

  // Step 9: Manifest Validation
  console.log('\n9. Manifest Validation:');
  const validationResult = validateManifest(sampleMF2Manifest);
  console.log(`  Format Detected: ${detectManifestFormat(sampleMF2Manifest)}`);
  console.log(`  Is Valid: ${validationResult.valid}`);
  console.log(`  Errors Count: ${validationResult.errors.length}`);

  console.log('\nIntegration demonstration completed successfully!');
}

// Run the demonstration
demonstrateIntegration();