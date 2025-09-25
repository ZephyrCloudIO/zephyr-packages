import type { Configuration } from '@rspack/core';
import { ZeErrors, ZephyrEngine, ZephyrError, logFn, ze_log } from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import type { RepackEnv } from '../type/zephyr-internal-types';
import { verify_mf_fastly_config } from './utils/ze-util-verification';
import { ZeRepackPlugin, type ZephyrRepackPluginOptions } from './ze-repack-plugin';

export interface ZephyrRepackOTAOptions {
  /** Enable OTA updates */
  enableOTA?: boolean;
  /** Application UID for OTA */
  applicationUid?: string;
  /** OTA configuration */
  otaConfig?: {
    checkInterval?: number;
    debug?: boolean;
    otaEndpoint?: string;
  };
}

export interface ZephyrRepackWithOTAOptions extends ZephyrRepackOTAOptions {
  /** Any additional Zephyr configuration */
  [key: string]: any;
}

/** Enhanced withZephyr function that supports OTA updates for React Native */
export function withZephyrOTA(userOptions: ZephyrRepackWithOTAOptions = {}): (
  // First return: A function taking a config function
  configFn: (env: RepackEnv) => Configuration
) => (
  // Second return: A function taking a config object
  config: RepackEnv
) => Promise<Configuration> {
  // RETURN 1: Function that takes the user's config function
  return (configFn: (env: RepackEnv) => Configuration) => {
    // RETURN 2: Function that takes the base config and returns the final webpack config
    return (config: RepackEnv) => {
      // Generate user config by calling their function with env
      const userConfig = configFn({
        platform: config.platform,
        mode: config.mode,
      });

      const enhancedZephyrConfig = {
        ...userOptions,
        target: config.platform,
      };

      ze_log.init('Enhanced Zephyr config with OTA: ', enhancedZephyrConfig);

      // Return the final processed configuration with OTA enhancements
      return _zephyr_configuration_with_ota(userConfig, enhancedZephyrConfig);
    };
  };
}

async function _zephyr_configuration_with_ota(
  config: Configuration,
  userOptions: ZephyrRepackWithOTAOptions
): Promise<Configuration> {
  try {
    // Create instance of ZephyrEngine to track the application
    const zephyr_engine = await ZephyrEngine.create({
      builder: 'repack',
      context: config.context,
    });

    ze_log.init('Configuring with Zephyr OTA... \n config: ', config);

    if (!userOptions?.target) {
      throw new ZephyrError(ZeErrors.ERR_MISSING_PLATFORM);
    }
    zephyr_engine.env.target = userOptions.target;

    const dependency_pairs = extractFederatedDependencyPairs(config);

    ze_log.init(
      'Resolving and building towards target by zephyr_engine.env.target: ',
      zephyr_engine.env.target
    );

    const resolved_dependency_pairs =
      await zephyr_engine.resolve_remote_dependencies(dependency_pairs);

    // Enhanced remote config mutation with OTA support
    mutWebpackFederatedRemotesConfigWithOTA(
      zephyr_engine,
      config,
      resolved_dependency_pairs,
      userOptions
    );

    ze_log.remotes(
      'dependency resolution completed successfully with OTA enhancements...'
    );

    const mf_configs = makeCopyOfModuleFederationOptions(config);
    await verify_mf_fastly_config(mf_configs, zephyr_engine);

    ze_log.app('Application uid created with OTA support...');

    // Add enhanced plugin with OTA capabilities
    config.plugins?.push(
      new ZeRepackOTAPlugin({
        zephyr_engine,
        mfConfig: mf_configs,
        target: zephyr_engine.env.target,
        otaOptions: userOptions,
      })
    );
  } catch (error) {
    logFn('error', ZephyrError.format(error));
  }

  return config;
}

/** Enhanced remote config mutation that includes OTA runtime plugin injection */
function mutWebpackFederatedRemotesConfigWithOTA<Compiler>(
  zephyr_engine: ZephyrEngine,
  config: any,
  resolvedDependencyPairs: any[] | null,
  userOptions: ZephyrRepackWithOTAOptions
): void {
  // First, apply standard remote config mutation
  mutWebpackFederatedRemotesConfig(zephyr_engine, config, resolvedDependencyPairs);

  // Then enhance with OTA capabilities if enabled
  if (userOptions.enableOTA) {
    injectOTARuntimePlugin(config, userOptions);
  }
}

/** Inject OTA-enhanced runtime plugin into the webpack configuration */
function injectOTARuntimePlugin(
  config: Configuration,
  userOptions: ZephyrRepackWithOTAOptions
): void {
  try {
    // Find Module Federation plugin and inject OTA runtime plugin
    const plugins = config.plugins || [];

    plugins.forEach((plugin: any) => {
      if (plugin?.constructor?.name === 'ModuleFederationPlugin') {
        const pluginOptions = plugin._options || plugin.options;

        if (pluginOptions) {
          // Initialize runtime plugins array if needed
          if (!pluginOptions.runtimePlugins) {
            pluginOptions.runtimePlugins = [];
          }

          // Create OTA runtime plugin code
          const otaRuntimePluginCode = createOTARuntimePluginCode(userOptions);

          // Add to runtime plugins (as code string for webpack)
          pluginOptions.runtimePlugins.push(otaRuntimePluginCode);

          ze_log.remotes('OTA runtime plugin injected into Module Federation config');
        }
      }
    });
  } catch (error) {
    ze_log.remotes('Failed to inject OTA runtime plugin:', error);
  }
}

/** Create OTA runtime plugin code for injection */
function createOTARuntimePluginCode(userOptions: ZephyrRepackWithOTAOptions): string {
  const otaConfig = userOptions.otaConfig || {};
  const appUid = userOptions.applicationUid || 'unknown';

  return `
function() {
  // Enhanced Zephyr Runtime Plugin with OTA support for React Native
  const { createZephyrRuntimePluginWithOTA } = require('zephyr-xpack-internal/src/xpack-extract/runtime-plugin');

  const { plugin, instance } = createZephyrRuntimePluginWithOTA({
    manifestUrl: '/zephyr-manifest.json',
    onManifestChange: function(newManifest, oldManifest) {
      console.log('[Zephyr OTA] Manifest updated:', newManifest.version);

      // Notify React Native OTA worker if available
      if (typeof global !== 'undefined' && global.__ZEPHYR_OTA_WORKER__) {
        global.__ZEPHYR_OTA_WORKER__.onManifestChange(newManifest, oldManifest);
      }
    },
    onManifestError: function(error) {
      console.warn('[Zephyr OTA] Manifest error:', error);
    }
  });

  // Store globally for OTA worker access
  if (typeof global !== 'undefined') {
    global.__ZEPHYR_RUNTIME_PLUGIN__ = plugin;
    global.__ZEPHYR_RUNTIME_PLUGIN_INSTANCE__ = instance;

    // Initialize OTA worker if enabled
    try {
      const { ZephyrOTAWorker } = require('zephyr-rn-ota');

      const otaWorker = new ZephyrOTAWorker({
        applicationUid: '${appUid}',
        checkInterval: ${otaConfig.checkInterval || 30 * 60 * 1000},
        debug: ${Boolean(otaConfig.debug)},
        otaEndpoint: '${otaConfig.otaEndpoint || ''}'
      }, {
        onUpdateAvailable: function(update) {
          console.log('[Zephyr OTA] Update available:', update.version);
          global.__ZEPHYR_OTA_UPDATE_AVAILABLE__ && global.__ZEPHYR_OTA_UPDATE_AVAILABLE__(update);
        },
        onUpdateError: function(error) {
          console.warn('[Zephyr OTA] Update check error:', error);
        },
        onUpdateApplied: function(version) {
          console.log('[Zephyr OTA] Update applied:', version);
        }
      });

      // Connect to runtime plugin
      otaWorker.setRuntimePlugin(instance);

      // Store globally and auto-start
      global.__ZEPHYR_OTA_WORKER__ = otaWorker;
      otaWorker.start();

      console.log('[Zephyr OTA] Worker initialized for React Native');
    } catch (error) {
      console.warn('[Zephyr OTA] Failed to initialize OTA worker:', error);
    }
  }

  return plugin;
}
`;
}

/** Enhanced Re.Pack plugin with OTA capabilities */
class ZeRepackOTAPlugin extends ZeRepackPlugin {
  private otaOptions: ZephyrRepackWithOTAOptions;

  constructor(
    options: Omit<ZephyrRepackPluginOptions, 'pluginName'> & {
      otaOptions: ZephyrRepackWithOTAOptions;
    }
  ) {
    super(options);
    this.otaOptions = options.otaOptions;
  }

  apply(compiler: any): void {
    // Call parent apply method first
    super.apply(compiler);

    // Add OTA-specific enhancements
    if (this.otaOptions.enableOTA) {
      this.addOTAEnhancements(compiler);
    }
  }

  private addOTAEnhancements(compiler: any): void {
    // Add hooks for OTA-specific functionality
    compiler.hooks.emit.tapAsync(
      'ZeRepackOTAPlugin',
      (compilation: any, callback: any) => {
        try {
          // Generate enhanced manifest with OTA metadata
          this.generateOTAManifest(compilation);
          callback();
        } catch (error) {
          ze_log.error('Failed to generate OTA manifest:', error);
          callback(error);
        }
      }
    );
  }

  private generateOTAManifest(compilation: any): void {
    // Enhanced manifest generation for OTA
    const manifestContent = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      ota_enabled: true,
      application_uid: this.otaOptions.applicationUid,
      dependencies: {}, // Would be populated with resolved dependencies
    };

    const manifestSource = JSON.stringify(manifestContent, null, 2);

    // Add to webpack assets
    compilation.assets['zephyr-manifest.json'] = {
      source: () => manifestSource,
      size: () => manifestSource.length,
    };

    ze_log.remotes('Generated OTA-enhanced manifest');
  }
}
