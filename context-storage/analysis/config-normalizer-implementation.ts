/**
 * ConfigNormalizer - Core utility for configuration normalization
 * 
 * This abstraction centralizes all configuration normalization functionality
 * to eliminate duplication between different implementations.
 */

import { BundlerType } from './feature-detector-implementation';
import { PathUtils } from './path-utils-implementation';

/**
 * Base configuration options interface
 */
export interface BaseConfigOptions {
  /**
   * Whether the plugin is enabled
   */
  enabled?: boolean;
  
  /**
   * Additional options for the base tag
   */
  baseTagOptions?: Record<string, string>;
  
  /**
   * Override base path (overrides bundler's config)
   */
  basePath?: string;
  
  /**
   * Override public path (for webpack/rspack)
   */
  publicPath?: string;
  
  /**
   * Additional metadata to add to the manifest
   */
  additionalMetadata?: Record<string, any>;
  
  [key: string]: any;
}

/**
 * Normalized base configuration
 */
export interface NormalizedBaseConfig {
  /**
   * Whether the plugin is enabled
   */
  enabled: boolean;
  
  /**
   * Additional options for the base tag
   */
  baseTagOptions: Record<string, string>;
  
  /**
   * Override base path 
   */
  basePath: string | undefined;
  
  /**
   * Override public path
   */
  publicPath: string | undefined;
  
  /**
   * Additional metadata to add to the manifest
   */
  additionalMetadata: Record<string, any>;
}

/**
 * Remote entry options
 */
export interface RemoteEntryOptions {
  /**
   * Manifest output filename
   */
  manifestFilename?: string;
  
  /**
   * Whether to generate a manifest file
   */
  generateManifestFile?: boolean;
  
  /**
   * Whether to inject the base into HTML
   */
  injectIntoHtml?: boolean;
  
  /**
   * Whether to transform HTML
   */
  transformHtml?: boolean;
}

/**
 * Normalized remote entry options
 */
export interface NormalizedRemoteEntryOptions {
  /**
   * Manifest output filename
   */
  manifestFilename: string;
  
  /**
   * Whether to generate a manifest file
   */
  generateManifestFile: boolean;
  
  /**
   * Whether to inject the base into HTML
   */
  injectIntoHtml: boolean;
  
  /**
   * Whether to transform HTML
   */
  transformHtml: boolean;
}

/**
 * ConfigNormalizer - Main class for configuration normalization
 */
export class ConfigNormalizer {
  /**
   * Default options for base configuration
   * @private
   */
  private static readonly DEFAULT_BASE_CONFIG: NormalizedBaseConfig = {
    enabled: true,
    baseTagOptions: {},
    basePath: undefined,
    publicPath: undefined,
    additionalMetadata: {}
  };

  /**
   * Default options for remote entry
   * @private
   */
  private static readonly DEFAULT_REMOTE_ENTRY_OPTIONS: NormalizedRemoteEntryOptions = {
    manifestFilename: 'remote-entry-manifest.json',
    generateManifestFile: true,
    injectIntoHtml: true,
    transformHtml: true
  };

  /**
   * Normalizes base configuration options
   * 
   * @param options User-provided options
   * @returns Normalized configuration
   */
  static normalizeBaseConfig(options: BaseConfigOptions = {}): NormalizedBaseConfig {
    return {
      enabled: options.enabled ?? this.DEFAULT_BASE_CONFIG.enabled,
      baseTagOptions: options.baseTagOptions ?? this.DEFAULT_BASE_CONFIG.baseTagOptions,
      basePath: options.basePath,
      publicPath: options.publicPath,
      additionalMetadata: options.additionalMetadata ?? this.DEFAULT_BASE_CONFIG.additionalMetadata
    };
  }

  /**
   * Normalizes remote entry options
   * 
   * @param options User-provided options
   * @returns Normalized options
   */
  static normalizeRemoteEntryOptions(options: RemoteEntryOptions = {}): NormalizedRemoteEntryOptions {
    return {
      manifestFilename: options.manifestFilename ?? this.DEFAULT_REMOTE_ENTRY_OPTIONS.manifestFilename,
      generateManifestFile: options.generateManifestFile ?? this.DEFAULT_REMOTE_ENTRY_OPTIONS.generateManifestFile,
      injectIntoHtml: options.injectIntoHtml ?? this.DEFAULT_REMOTE_ENTRY_OPTIONS.injectIntoHtml,
      transformHtml: options.transformHtml ?? this.DEFAULT_REMOTE_ENTRY_OPTIONS.transformHtml
    };
  }

  /**
   * Generic options normalization function
   * 
   * @param options User-provided options
   * @param defaults Default options
   * @returns Normalized options
   */
  static normalizeOptions<T>(options: Partial<T>, defaults: T): T {
    return {
      ...defaults,
      ...options
    };
  }

  /**
   * Extracts base path from configuration based on bundler type
   * 
   * @param config Bundler configuration
   * @param bundlerType Type of bundler
   * @param override Optional override value
   * @returns Extracted base path
   */
  static extractBasePath(config: any, bundlerType: BundlerType, override?: string): string {
    // Use override if provided
    if (override !== undefined) {
      return PathUtils.normalizePath(override);
    }
    
    // Extract based on bundler type
    switch (bundlerType) {
      case 'webpack':
      case 'rspack':
        return this.extractPublicPath(config);
        
      case 'vite':
        return this.extractViteBase(config);
        
      case 'rollup':
      case 'rolldown':
        return this.extractRollupBase(config);
        
      case 'parcel':
        return this.extractParcelBase(config);
        
      default:
        return './';
    }
  }

  /**
   * Extracts public path from webpack/rspack configuration
   * 
   * @param config Webpack or Rspack configuration
   * @returns Extracted public path
   */
  static extractPublicPath(config: any): string {
    if (!config || typeof config !== 'object') {
      return './';
    }

    const output = config.output;
    if (!output || typeof output !== 'object') {
      return './';
    }

    const publicPath = output.publicPath;
    
    // Handle special case 'auto' in Webpack 5+
    if (publicPath === 'auto' || publicPath === undefined || publicPath === null || publicPath === '') {
      return './';
    }

    return PathUtils.normalizePath(publicPath);
  }

  /**
   * Extracts base path from Vite configuration
   * 
   * @param config Vite configuration
   * @returns Extracted base path
   */
  static extractViteBase(config: any): string {
    if (!config || typeof config !== 'object') {
      return './';
    }

    const base = config.base;
    
    if (base === undefined || base === null || base === '') {
      return './';
    }

    return PathUtils.normalizePath(base);
  }

  /**
   * Extracts base path from Rollup configuration
   * 
   * @param config Rollup configuration
   * @returns Extracted base path
   */
  static extractRollupBase(config: any): string {
    if (!config || typeof config !== 'object') {
      return './';
    }

    // Check output.baseUrl
    if (config.output?.baseUrl) {
      return PathUtils.normalizePath(config.output.baseUrl);
    }
    
    // Check output.assetFileNames path prefix
    if (config.output?.assetFileNames && typeof config.output.assetFileNames === 'string') {
      const match = config.output.assetFileNames.match(/^([./\\]+)/);
      if (match) {
        return PathUtils.normalizePath(match[1]);
      }
    }

    return './';
  }

  /**
   * Extracts base path from Parcel configuration
   * 
   * @param config Parcel configuration
   * @returns Extracted base path
   */
  static extractParcelBase(config: any): string {
    if (!config || typeof config !== 'object') {
      return './';
    }

    // Check publicUrl
    if (config.publicUrl) {
      return PathUtils.normalizePath(config.publicUrl);
    }

    return './';
  }

  /**
   * Extracts output path from configuration based on bundler type
   * 
   * @param config Bundler configuration
   * @param bundlerType Type of bundler
   * @returns Extracted output path
   */
  static extractOutputPath(config: any, bundlerType: BundlerType): string {
    switch (bundlerType) {
      case 'webpack':
      case 'rspack':
        return this.extractWebpackOutputPath(config);
        
      case 'vite':
        return this.extractViteOutputPath(config);
        
      case 'rollup':
      case 'rolldown':
        return this.extractRollupOutputPath(config);
        
      case 'parcel':
        return this.extractParcelOutputPath(config);
        
      default:
        return 'dist';
    }
  }

  /**
   * Extracts output path from webpack/rspack configuration
   * 
   * @param config Webpack or Rspack configuration
   * @returns Extracted output path
   */
  static extractWebpackOutputPath(config: any): string {
    if (!config || typeof config !== 'object' || !config.output || typeof config.output !== 'object') {
      return 'dist';
    }

    return config.output.path || 'dist';
  }

  /**
   * Extracts output path from Vite configuration
   * 
   * @param config Vite configuration
   * @returns Extracted output path
   */
  static extractViteOutputPath(config: any): string {
    if (!config || typeof config !== 'object') {
      return 'dist';
    }

    return config.build?.outDir || 'dist';
  }

  /**
   * Extracts output path from Rollup configuration
   * 
   * @param config Rollup configuration
   * @returns Extracted output path
   */
  static extractRollupOutputPath(config: any): string {
    if (!config || typeof config !== 'object' || !config.output) {
      return 'dist';
    }

    return config.output.dir || (config.output.file ? PathUtils.getParentPath(config.output.file) : 'dist');
  }

  /**
   * Extracts output path from Parcel configuration
   * 
   * @param config Parcel configuration
   * @returns Extracted output path
   */
  static extractParcelOutputPath(config: any): string {
    if (!config || typeof config !== 'object') {
      return 'dist';
    }

    return config.distDir || 'dist';
  }

  /**
   * Creates modified configuration with base href applied
   * 
   * @param config Original configuration
   * @param basePath Base path to apply
   * @param bundlerType Type of bundler
   * @returns Modified configuration
   */
  static applyBaseToConfig(config: any, basePath: string, bundlerType: BundlerType): any {
    const newConfig = JSON.parse(JSON.stringify(config));
    
    switch (bundlerType) {
      case 'webpack':
      case 'rspack':
        if (!newConfig.output) {
          newConfig.output = {};
        }
        newConfig.output.publicPath = basePath;
        break;
        
      case 'vite':
        newConfig.base = basePath;
        break;
        
      case 'rollup':
      case 'rolldown':
        if (!newConfig.output) {
          newConfig.output = {};
        }
        newConfig.output.baseUrl = basePath;
        break;
        
      case 'parcel':
        newConfig.publicUrl = basePath;
        break;
    }
    
    return newConfig;
  }

  /**
   * Creates a manifest object with base href
   * 
   * @param manifest Existing manifest or empty object
   * @param basePath Base path to add
   * @returns Manifest with baseHref added
   */
  static applyBaseToManifest(manifest: any, basePath: string): any {
    if (!manifest || typeof manifest !== 'object') {
      manifest = {};
    }
    
    return {
      ...manifest,
      baseHref: basePath
    };
  }

  /**
   * Processes configuration to extract and apply base path
   * 
   * @param config Bundler configuration
   * @param options Plugin options
   * @param bundlerType Type of bundler
   * @param manifest Existing manifest
   * @returns Updated manifest with base path
   */
  static processConfig(
    config: any, 
    options: BaseConfigOptions,
    bundlerType: BundlerType,
    manifest: any = {}
  ): any {
    const normalizedOptions = this.normalizeBaseConfig(options);
    
    // Extract base path
    const basePath = this.extractBasePath(
      config, 
      bundlerType,
      normalizedOptions.basePath || normalizedOptions.publicPath
    );
    
    // Apply to manifest
    return this.applyBaseToManifest({
      ...manifest,
      ...normalizedOptions.additionalMetadata
    }, basePath);
  }
}