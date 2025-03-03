/**
 * BaseHref Webpack Plugin
 * 
 * This plugin integrates the BaseHref functionality with Webpack/Rspack,
 * providing proper path handling and asset URL normalization.
 */

import { Compiler } from 'webpack';
import { BaseHrefIntegration, WebpackPathHandler } from './basehref-implementation-skeleton';

export interface BaseHrefWebpackPluginOptions {
  /**
   * Enable or disable the plugin
   * @default true
   */
  enabled?: boolean;

  /**
   * Override public path (overrides webpack's `output.publicPath` config)
   * @default undefined
   */
  publicPath?: string;

  /**
   * Additional metadata to add to the manifest
   * @default {}
   */
  additionalMetadata?: Record<string, any>;

  /**
   * Manifest output filename
   * @default 'basehref-manifest.json'
   */
  manifestFilename?: string;

  /**
   * Enable manifest file generation
   * @default true
   */
  generateManifestFile?: boolean;

  /**
   * Inject base into HTML webpack plugin
   * @default true
   */
  injectIntoHtml?: boolean;
}

/**
 * BaseHref Webpack Plugin
 * Provides path handling for webpack/rspack with proper base href support
 */
export class BaseHrefWebpackPlugin {
  private options: Required<BaseHrefWebpackPluginOptions>;
  private manifest: Record<string, any> = {};

  constructor(options: BaseHrefWebpackPluginOptions = {}) {
    this.options = {
      enabled: true,
      publicPath: undefined,
      additionalMetadata: {},
      manifestFilename: 'basehref-manifest.json',
      generateManifestFile: true,
      injectIntoHtml: true,
      ...options
    };
  }

  apply(compiler: Compiler): void {
    if (!this.options.enabled) return;

    // Extract publicPath from config or use override
    const configPublicPath = this.options.publicPath !== undefined
      ? this.options.publicPath
      : compiler.options.output?.publicPath;

    // Create config object for extraction
    const config = {
      output: {
        publicPath: configPublicPath
      }
    };

    // Process webpack config and generate manifest
    this.manifest = {
      ...this.options.additionalMetadata
    };
    this.manifest = BaseHrefIntegration.processWebpackConfig(config, this.manifest);

    // Log the detected base path
    compiler.hooks.initialize.tap('BaseHrefWebpackPlugin', () => {
      console.log(`[BaseHrefWebpackPlugin] Base path detected: ${this.manifest.baseHref}`);
    });

    // Inject into compilation
    compiler.hooks.compilation.tap('BaseHrefWebpackPlugin', (compilation) => {
      // Make baseHref available as __webpack_public_path__ if it's not already set
      compilation.hooks.beforeModuleIds.tap('BaseHrefWebpackPlugin', () => {
        // Add baseHref to webpack public path options
        if (typeof compilation.outputOptions.publicPath === 'undefined' || 
            compilation.outputOptions.publicPath === 'auto') {
          compilation.outputOptions.publicPath = this.manifest.baseHref;
        }
      });

      // Integrate with HtmlWebpackPlugin if present and option enabled
      if (this.options.injectIntoHtml && compilation.hooks.htmlWebpackPluginBeforeHtmlProcessing) {
        compilation.hooks.htmlWebpackPluginBeforeHtmlProcessing.tap('BaseHrefWebpackPlugin', (data) => {
          // Add base tag to HTML
          data.html = BaseHrefIntegration.generateHtmlWithBase(data.html, this.manifest.baseHref);
          return data;
        });
      }
    });

    // Generate manifest file
    if (this.options.generateManifestFile) {
      compiler.hooks.emit.tap('BaseHrefWebpackPlugin', (compilation) => {
        const manifestContent = JSON.stringify(this.manifest, null, 2);
        compilation.assets[this.options.manifestFilename] = {
          source: () => manifestContent,
          size: () => manifestContent.length
        };
      });
    }

    // Expose the manifest to other plugins
    compiler.hooks.afterPlugins.tap('BaseHrefWebpackPlugin', () => {
      // @ts-ignore Add a custom property to the compiler instance
      compiler.baseHrefManifest = this.manifest;
    });
  }

  /**
   * Gets the current manifest
   * Useful for accessing in other plugins or webpack loaders
   */
  getManifest(): Record<string, any> {
    return this.manifest;
  }
}

/**
 * Module for runtime base path detection
 * Can be used in client code to get the base path at runtime
 * 
 * @example
 * // Import in your code
 * import { detectBasePath } from './basehref-webpack-runtime';
 * 
 * // Use it for asset URLs
 * const imageUrl = new URL('/images/logo.png', detectBasePath()).href;
 */
export const runtimeModule = `
// BaseHref runtime detection
export function detectBasePath() {
  // Browser environment check
  if (typeof document === 'undefined') {
    return './';
  }

  // Try to get base from document.baseURI
  if (document.baseURI) {
    try {
      const urlObj = new URL(document.baseURI);
      let basePath = urlObj.pathname;
      
      // Ensure trailing slash
      if (!basePath.endsWith('/')) {
        basePath += '/';
      }
      
      return basePath;
    } catch (error) {
      console.warn('Failed to parse base URI:', error);
    }
  }

  // Fall back to script tag detection
  try {
    const scriptTags = document.querySelectorAll('script[src]');
    if (scriptTags.length > 0) {
      // Get the first script with a src attribute
      const scriptSrc = scriptTags[0].getAttribute('src');
      if (scriptSrc) {
        // If it's a full URL
        if (scriptSrc.includes('://') || scriptSrc.startsWith('//')) {
          const urlObj = new URL(scriptSrc);
          const pathname = urlObj.pathname;
          
          // If pathname ends with a file (contains a dot after the last slash)
          const lastSlashIndex = pathname.lastIndexOf('/');
          
          // If it's a file path, get the directory
          let basePath = lastSlashIndex >= 0 
            ? pathname.substring(0, lastSlashIndex + 1) 
            : pathname;
          
          // Ensure trailing slash
          if (!basePath.endsWith('/')) {
            basePath += '/';
          }
          
          return basePath;
        } 
        // Relative path
        else {
          const lastSlashIndex = scriptSrc.lastIndexOf('/');
          if (lastSlashIndex >= 0) {
            return scriptSrc.substring(0, lastSlashIndex + 1);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Failed to detect base path from script tags:', error);
  }

  // Default fallback
  return './';
}

// Expose to global scope for easier access
if (typeof window !== 'undefined') {
  window.__BASEHREF__ = detectBasePath();
}
`;

/**
 * Helper function to create the webpack plugin
 * Just a convenience function for better API
 * 
 * @param options Plugin options
 * @returns BaseHrefWebpackPlugin instance
 */
export function webpackBaseHrefPlugin(options: BaseHrefWebpackPluginOptions = {}): BaseHrefWebpackPlugin {
  return new BaseHrefWebpackPlugin(options);
}