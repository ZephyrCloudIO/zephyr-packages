/**
 * Remote Types Webpack Plugin
 * 
 * This plugin integrates the Remote Types Detection functionality with Webpack/Rspack,
 * providing automatic detection of rendering approach (CSR/SSR) and framework.
 */

import { Compiler } from 'webpack';
import { RemoteTypeIntegration, RenderType, FrameworkType } from './remote-types-detection-skeleton';
import * as fs from 'fs';
import * as path from 'path';

export interface RemoteTypesWebpackPluginOptions {
  /**
   * Enable or disable the plugin
   * @default true
   */
  enabled?: boolean;

  /**
   * Override render type detection with explicit type
   * @default undefined
   */
  renderType?: RenderType;

  /**
   * Override framework detection with explicit framework
   * @default undefined
   */
  framework?: FrameworkType;

  /**
   * Path to package.json
   * @default 'package.json'
   */
  packageJsonPath?: string;

  /**
   * Output enhanced manifest
   * @default true
   */
  outputManifest?: boolean;

  /**
   * Manifest output filename
   * @default 'remote-types-manifest.json'
   */
  manifestFilename?: string;
  
  /**
   * Log detection results
   * @default true
   */
  logDetectionResults?: boolean;

  /**
   * Additional metadata to add to the manifest
   * @default {}
   */
  additionalMetadata?: Record<string, any>;

  /**
   * Apply detected configuration
   * @default true
   */
  applyDetectedConfig?: boolean;

  /**
   * Update Module Federation configuration based on detected type
   * @default true
   */
  updateModuleFederationConfig?: boolean;
}

/**
 * Remote Types Webpack Plugin
 * Provides automatic detection of rendering approach and framework
 */
export class RemoteTypesWebpackPlugin {
  private options: Required<RemoteTypesWebpackPluginOptions>;
  private manifest: Record<string, any> = {};
  private detectedRenderType: RenderType = 'csr';
  private detectedFramework: FrameworkType = 'unknown';

  constructor(options: RemoteTypesWebpackPluginOptions = {}) {
    this.options = {
      enabled: true,
      renderType: undefined,
      framework: undefined,
      packageJsonPath: 'package.json',
      outputManifest: true,
      manifestFilename: 'remote-types-manifest.json',
      logDetectionResults: true,
      additionalMetadata: {},
      applyDetectedConfig: true,
      updateModuleFederationConfig: true,
      ...options
    };
  }

  apply(compiler: Compiler): void {
    if (!this.options.enabled) return;

    // Initialize as early as possible
    compiler.hooks.initialize.tap('RemoteTypesWebpackPlugin', () => {
      // Read package.json
      let packageJson = {};
      try {
        const packageJsonContent = fs.readFileSync(this.options.packageJsonPath, 'utf-8');
        packageJson = JSON.parse(packageJsonContent);
      } catch (error) {
        console.warn(`[RemoteTypesWebpackPlugin] Failed to read package.json at ${this.options.packageJsonPath}:`, error);
      }
      
      // Configuration object with explicit overrides
      const explicitConfig = {
        renderType: this.options.renderType,
        framework: this.options.framework,
        ...this.options.additionalMetadata
      };
      
      // Apply remote type detection
      this.manifest = RemoteTypeIntegration.applyRemoteTypeToManifest(
        explicitConfig, 
        packageJson, 
        compiler.options
      );
      
      // Store detection results
      this.detectedRenderType = this.manifest.renderType;
      this.detectedFramework = this.manifest.framework;
      
      // Log detection results
      if (this.options.logDetectionResults) {
        console.log(`[RemoteTypesWebpackPlugin] Detected render type: ${this.detectedRenderType}`);
        console.log(`[RemoteTypesWebpackPlugin] Detected framework: ${this.detectedFramework}`);
        
        if (this.manifest.frameworkVersion) {
          console.log(`[RemoteTypesWebpackPlugin] Framework version: ${this.manifest.frameworkVersion}`);
        }
        
        // Log overrides
        if (this.options.renderType) {
          console.log(`[RemoteTypesWebpackPlugin] Render type explicitly set to: ${this.options.renderType}`);
        }
        
        if (this.options.framework) {
          console.log(`[RemoteTypesWebpackPlugin] Framework explicitly set to: ${this.options.framework}`);
        }
      }
      
      // Apply configuration based on detected type
      if (this.options.applyDetectedConfig) {
        this.applyConfiguration(compiler);
      }
    });

    // Modify Module Federation configuration if present
    if (this.options.updateModuleFederationConfig) {
      compiler.hooks.compilation.tap('RemoteTypesWebpackPlugin', (compilation) => {
        // Find Module Federation plugin
        const plugins = compiler.options.plugins || [];
        for (const plugin of plugins) {
          const pluginName = plugin.constructor?.name || '';
          
          if (pluginName === 'ModuleFederationPlugin' || 
              pluginName === 'EasyFederationPlugin' || 
              pluginName === 'FederationPlugin') {
            
            // @ts-ignore Plugin has _options in webpack
            const mfOptions = plugin._options;
            
            if (mfOptions && !mfOptions.renderType) {
              // Add render type to MF options
              mfOptions.renderType = this.detectedRenderType;
              
              if (this.options.logDetectionResults) {
                console.log(`[RemoteTypesWebpackPlugin] Added renderType: ${this.detectedRenderType} to Module Federation configuration`);
              }
            }
          }
        }
      });
    }

    // Generate manifest file
    if (this.options.outputManifest) {
      compiler.hooks.emit.tap('RemoteTypesWebpackPlugin', (compilation) => {
        try {
          const manifestContent = JSON.stringify(this.manifest, null, 2);
          compilation.assets[this.options.manifestFilename] = {
            source: () => manifestContent,
            size: () => manifestContent.length
          };
          
          if (this.options.logDetectionResults) {
            console.log(`[RemoteTypesWebpackPlugin] Manifest file will be written to: ${this.options.manifestFilename}`);
          }
        } catch (error) {
          console.error('[RemoteTypesWebpackPlugin] Failed to create manifest asset:', error);
        }
      });
    }
    
    // Expose the manifest to other plugins
    compiler.hooks.afterPlugins.tap('RemoteTypesWebpackPlugin', () => {
      // @ts-ignore Add a custom property to the compiler instance
      compiler.remoteTypesManifest = this.manifest;
    });
  }

  /**
   * Applies configuration based on detected render type
   */
  private applyConfiguration(compiler: Compiler): void {
    // Only apply if not explicitly configured
    if (compiler.options.target) {
      if (this.options.logDetectionResults) {
        console.log(`[RemoteTypesWebpackPlugin] Target already configured: ${compiler.options.target}, skipping auto-configuration`);
      }
      return;
    }
    
    // Configure based on render type
    if (this.detectedRenderType === 'ssr') {
      // Don't modify directly, only suggest
      if (this.options.logDetectionResults) {
        console.log('[RemoteTypesWebpackPlugin] SSR detected, recommended configuration:');
        console.log('target: "node"');
        console.log('output.libraryTarget: "commonjs2"');
      }
    } else if (this.detectedRenderType === 'csr') {
      // Don't modify directly, only suggest
      if (this.options.logDetectionResults) {
        console.log('[RemoteTypesWebpackPlugin] CSR detected, recommended configuration:');
        console.log('target: "web"');
        console.log('output.libraryTarget: "umd"');
      }
    }
  }

  /**
   * Gets the current manifest
   * Useful for accessing in other plugins or webpack loaders
   */
  getManifest(): Record<string, any> {
    return this.manifest;
  }
  
  /**
   * Gets the detected render type
   */
  getDetectedRenderType(): RenderType {
    return this.detectedRenderType;
  }
  
  /**
   * Gets the detected framework
   */
  getDetectedFramework(): FrameworkType {
    return this.detectedFramework;
  }
}

/**
 * Runtime detection module
 * Can be used in client code to get the render type and framework
 */
export const runtimeModule = `
// Remote Types runtime detection
export function detectRemoteTypes() {
  // Check for manifest data injected by webpack
  if (typeof window !== 'undefined' && window.__REMOTE_TYPES_MANIFEST__) {
    return window.__REMOTE_TYPES_MANIFEST__;
  }
  
  // Fallback to basic browser detection for SSR
  const isServer = typeof window === 'undefined';
  
  return {
    renderType: isServer ? 'ssr' : 'csr',
    framework: 'unknown'
  };
}

// Expose to global scope for easier access
if (typeof window !== 'undefined') {
  window.__REMOTE_TYPES_DETECTION__ = detectRemoteTypes();
}
`;

/**
 * Helper function to create the webpack plugin
 * Just a convenience function for better API
 * 
 * @param options Plugin options
 * @returns RemoteTypesWebpackPlugin instance
 */
export function webpackRemoteTypesPlugin(options: RemoteTypesWebpackPluginOptions = {}): RemoteTypesWebpackPlugin {
  return new RemoteTypesWebpackPlugin(options);
}