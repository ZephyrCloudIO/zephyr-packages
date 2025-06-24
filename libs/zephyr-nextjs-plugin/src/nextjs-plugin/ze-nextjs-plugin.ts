import type { Compiler } from 'webpack';
import { ZephyrEngine, ZephyrError, logFn, zeBuildAssets } from 'zephyr-agent';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import type { ModuleFederationPlugin } from 'zephyr-xpack-internal';
import {
  detectAndStoreBaseHref,
  logBuildSteps,
  setupZeDeploy,
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';

const pluginName = 'ZeNextJSPlugin';

export interface ZephyrNextJSInternalPluginOptions {
  zephyr_engine: ZephyrEngine | null;
  // webpack plugin name
  pluginName: string;
  // federated module config
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  // NextJS build context
  buildContext: {
    isServer: boolean;
    nextRuntime?: 'nodejs' | 'edge';
    buildId: string;
  };
  // hacks
  wait_for_index_html?: boolean;
  // NextJS specific options
  deployOnClientOnly?: boolean;
  preserveServerAssets?: boolean;
  // Additional fields for async initialization
  webpackConfig?: any;
  webpackContext?: string;
}

export class ZeNextJSPlugin {
  _options: ZephyrNextJSInternalPluginOptions;
  private _initialized: boolean = false;
  private _deploymentSetup: boolean = false;

  constructor(options: Omit<ZephyrNextJSInternalPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);
  }

  apply(compiler: Compiler): void {
    const { isServer, nextRuntime } = this._options.buildContext;
    
    // Handle deployment based on build context
    if (this._options.deployOnClientOnly && isServer) {
      // Skip deployment for server builds if deployOnClientOnly is true
      console.log(`🔍 Skipping Zephyr deployment for ${nextRuntime || 'server'} build`);
      return;
    }
    
    // Initialize Zephyr asynchronously in webpack hooks to avoid blocking Next.js
    compiler.hooks.beforeRun.tapAsync(pluginName, async (compiler, callback) => {
      try {
        if (!this._initialized && !this._options.zephyr_engine) {
          await this.initializeZephyr();
        }
        callback();
      } catch (error) {
        logFn('error', ZephyrError.format(error));
        callback();
      }
    });

    compiler.hooks.watchRun.tapAsync(pluginName, async (compiler, callback) => {
      try {
        if (!this._initialized && !this._options.zephyr_engine) {
          await this.initializeZephyr();
        }
        callback();
      } catch (error) {
        logFn('error', ZephyrError.format(error));
        callback();
      }
    });

    // Setup Zephyr deployment hooks when engine is ready
    if (this._options.zephyr_engine) {
      this.setupZephyrDeployment(compiler);
    } else {
      // If engine is not ready, wait for initialization and then setup
      compiler.hooks.compilation.tap(pluginName, () => {
        if (this._options.zephyr_engine && !this._deploymentSetup) {
          this.setupZephyrDeployment(compiler);
        }
      });
    }
  }

  private async initializeZephyr(): Promise<void> {
    try {
      if (this._initialized) return;

      // Create instance of ZephyrEngine to track the application
      const zephyr_engine = await ZephyrEngine.create({
        builder: 'webpack',
        context: this._options.webpackContext || process.cwd(),
      });

      // Resolve dependencies and update the config
      const dependencyPairs = extractFederatedDependencyPairs(this._options.webpackConfig);
      const resolved_dependency_pairs =
        await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

      // Mutate webpack federated remotes config
      if (this._options.webpackConfig) {
        mutWebpackFederatedRemotesConfig(zephyr_engine, this._options.webpackConfig, resolved_dependency_pairs);
      }

      const mfConfig = makeCopyOfModuleFederationOptions(this._options.webpackConfig);

      // Update our options
      this._options.zephyr_engine = zephyr_engine;
      this._options.mfConfig = mfConfig;
      this._initialized = true;

      console.log('✅ Zephyr engine initialized for Next.js');
    } catch (error) {
      logFn('error', `Failed to initialize Zephyr engine: ${ZephyrError.format(error)}`);
    }
  }

  private setupZephyrDeployment(compiler: Compiler): void {
    if (this._deploymentSetup || !this._options.zephyr_engine) {
      return;
    }

    // Set output path for the zephyr engine
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;
    
    // Detect and store base href - this is safe for NextJS
    detectAndStoreBaseHref(this._options.zephyr_engine, compiler);
    
    // Create a valid options object for the internal functions
    const validOptions = {
      ...this._options,
      zephyr_engine: this._options.zephyr_engine as ZephyrEngine, // Type assertion since we checked above
    };
    
    // Log build steps with NextJS context
    logBuildSteps(validOptions, compiler);
    
    // Setup deployment with NextJS-aware handling
    setupZeDeploy(validOptions, compiler);
    
    this._deploymentSetup = true;
    console.log('🔧 Zephyr deployment hooks configured for Next.js');
  }
}