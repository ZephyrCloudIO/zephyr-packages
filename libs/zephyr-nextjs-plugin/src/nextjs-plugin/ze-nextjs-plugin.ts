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

import { NextJSServerFunctionExtractor } from './server-function-extractor';
import type { ZephyrServerAsset, ZephyrNextJSSnapshot } from '../types';

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
  // Server function support (Phase 1)
  enableServerFunctions?: boolean;
  serverRuntime?: 'nodejs' | 'edge';
  enableMiddleware?: boolean;
  enableISR?: boolean;
  cacheStrategy?: 'kv' | 'r2' | 'hybrid';
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
    
    // Setup deployment with NextJS-aware handling including server functions
    this.setupNextJSDeployment(validOptions, compiler);
    
    this._deploymentSetup = true;
    console.log('🔧 Zephyr deployment hooks configured for Next.js');
  }

  private setupNextJSDeployment(
    options: ZephyrNextJSInternalPluginOptions & { zephyr_engine: ZephyrEngine },
    compiler: Compiler
  ): void {
    // Setup standard deployment for static assets
    setupZeDeploy(options, compiler);

    // Add server function processing if enabled
    if (options.enableServerFunctions) {
      compiler.hooks.afterEmit.tapAsync(pluginName, async (compilation, callback) => {
        try {
          await this.processServerFunctions(options, compiler);
          callback();
        } catch (error) {
          logFn('error', `Failed to process server functions: ${ZephyrError.format(error)}`);
          callback();
        }
      });
    }
  }

  private async processServerFunctions(
    options: ZephyrNextJSInternalPluginOptions & { zephyr_engine: ZephyrEngine },
    compiler: Compiler
  ): Promise<void> {
    try {
      const { buildContext } = options;
      const outputPath = compiler.outputPath;
      
      console.log('🔍 Processing NextJS server functions...');
      
      // Create server function extractor
      const extractor = new NextJSServerFunctionExtractor(
        outputPath,
        buildContext.buildId,
        options
      );
      
      // Extract server functions
      const { serverFunctions, routeManifest, buildManifest } = 
        await extractor.extractServerFunctions();
      
      if (serverFunctions.length === 0) {
        console.log('ℹ️  No server functions found to deploy');
        return;
      }
      
      console.log(`📦 Found ${serverFunctions.length} server functions to deploy`);
      
      // Process server functions similar to static assets
      for (const serverFunction of serverFunctions) {
        console.log(`  📄 ${serverFunction.type}: ${serverFunction.path} -> ${serverFunction.routes.join(', ')}`);
      }
      
      // Store server functions in the engine for upload
      // Note: This would require extending ZephyrEngine to support server functions
      // For now, we'll store them as metadata
      if (!options.zephyr_engine.buildProperties.serverFunctions) {
        (options.zephyr_engine.buildProperties as any).serverFunctions = [];
      }
      (options.zephyr_engine.buildProperties as any).serverFunctions.push(...serverFunctions);
      
      // Store manifests
      if (routeManifest) {
        (options.zephyr_engine.buildProperties as any).routeManifest = routeManifest;
      }
      if (buildManifest) {
        (options.zephyr_engine.buildProperties as any).buildManifest = buildManifest;
      }
      
      console.log('✅ Server functions processed successfully');
      
    } catch (error) {
      console.error('❌ Error processing server functions:', error);
      throw error;
    }
  }
}