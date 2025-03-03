/**
 * BaseHref Vite Plugin
 * 
 * This plugin integrates the BaseHref functionality with Vite,
 * providing proper path handling and HTML base tag injection.
 */

import type { Plugin, ResolvedConfig } from 'vite';
import { BaseHrefIntegration, ViteBaseHandler } from './basehref-implementation-skeleton';

export interface BaseHrefVitePluginOptions {
  /**
   * Enable or disable the plugin
   * @default true
   */
  enabled?: boolean;

  /**
   * Additional options for HTML base tag
   * @default {}
   */
  baseTagOptions?: Record<string, string>;

  /**
   * Override base path (overrides Vite's `base` config)
   * @default undefined
   */
  basePath?: string;

  /**
   * Enable or disable HTML transformation
   * @default true
   */
  transformHtml?: boolean;

  /**
   * Additional metadata to add to the manifest
   * @default {}
   */
  additionalMetadata?: Record<string, any>;
}

/**
 * Creates a Vite plugin for BaseHref integration
 * 
 * @param options Plugin options
 * @returns Vite plugin
 */
export function viteBaseHrefPlugin(options: BaseHrefVitePluginOptions = {}): Plugin {
  const {
    enabled = true,
    baseTagOptions = {},
    basePath,
    transformHtml = true,
    additionalMetadata = {}
  } = options;

  // Store resolved config
  let resolvedConfig: ResolvedConfig;
  // Store extracted base path
  let extractedBase: string;
  // Store manifest
  let manifest: Record<string, any> = {};

  return {
    name: 'vite-base-href',
    
    // Store the resolved config
    configResolved(config) {
      if (!enabled) return;
      
      resolvedConfig = config;
      
      // Extract base from config or use override
      const configBase = basePath !== undefined 
        ? basePath 
        : config.base;
      
      // Create initial config object for extraction
      const configObj = { base: configBase };
      
      // Extract base and store it
      extractedBase = ViteBaseHandler.extractBaseFromConfig(configObj);
      
      // Apply base to manifest
      manifest = {
        ...additionalMetadata,
      };
      
      manifest = BaseHrefIntegration.processViteConfig(configObj, manifest);
      
      // Log for debugging
      console.log(`[vite-base-href] Base path detected: ${manifest.baseHref}`);
    },
    
    // Add base tag to HTML
    transformIndexHtml(html) {
      if (!enabled || !transformHtml) return html;
      
      // Generate base tag attributes string
      const attributesString = Object.entries(baseTagOptions)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      
      // Create base tag with href and additional attributes
      const baseTag = `<base href="${manifest.baseHref}"${attributesString ? ' ' + attributesString : ''}>`;
      
      // Insert base tag or replace existing one
      return BaseHrefIntegration.generateHtmlWithBase(html, manifest.baseHref);
    },
    
    // Add hooks to expose the manifest
    resolveId(id) {
      if (id === 'virtual:base-href') {
        return '\0virtual:base-href';
      }
      return null;
    },
    
    load(id) {
      if (id === '\0virtual:base-href') {
        return `export default ${JSON.stringify(manifest)}`;
      }
      return null;
    }
  };
}

/**
 * Helper for using base path in runtime code
 * 
 * @example
 * // Import directly in your code
 * import baseHref from 'virtual:base-href';
 * 
 * // Use it for asset URLs
 * const imageUrl = new URL('/images/logo.png', baseHref.baseHref).href;
 */