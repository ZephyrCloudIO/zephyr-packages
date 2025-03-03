/**
 * Remote Types Vite Plugin
 * 
 * This plugin integrates the Remote Types Detection functionality with Vite,
 * providing automatic detection of rendering approach (CSR/SSR) and framework.
 */

import type { Plugin, ResolvedConfig } from 'vite';
import { RemoteTypeIntegration, RenderType, FrameworkType } from './remote-types-detection-skeleton';
import * as fs from 'fs';
import * as path from 'path';

export interface RemoteTypesVitePluginOptions {
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
}

/**
 * Creates a Vite plugin for Remote Types Detection
 * 
 * @param options Plugin options
 * @returns Vite plugin
 */
export function viteRemoteTypesPlugin(options: RemoteTypesVitePluginOptions = {}): Plugin {
  const {
    enabled = true,
    renderType,
    framework,
    packageJsonPath = 'package.json',
    outputManifest = true,
    manifestFilename = 'remote-types-manifest.json',
    logDetectionResults = true,
    additionalMetadata = {}
  } = options;

  // Store resolved config
  let resolvedConfig: ResolvedConfig;
  // Store manifest
  let manifest: Record<string, any> = {};
  // Detected render type
  let detectedRenderType: RenderType;
  // Detected framework
  let detectedFramework: FrameworkType;

  return {
    name: 'vite-remote-types',
    
    // Store the resolved config
    configResolved(config) {
      if (!enabled) return;
      
      resolvedConfig = config;
      
      // Read package.json
      let packageJson = {};
      try {
        const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
        packageJson = JSON.parse(packageJsonContent);
      } catch (error) {
        console.warn(`[vite-remote-types] Failed to read package.json at ${packageJsonPath}:`, error);
      }
      
      // Configuration object with explicit overrides
      const explicitConfig = {
        renderType: renderType,
        framework: framework,
        ...additionalMetadata
      };
      
      // Apply remote type detection
      manifest = RemoteTypeIntegration.applyRemoteTypeToManifest(explicitConfig, packageJson);
      
      // Store detection results
      detectedRenderType = manifest.renderType;
      detectedFramework = manifest.framework;
      
      // Log detection results
      if (logDetectionResults) {
        console.log(`[vite-remote-types] Detected render type: ${detectedRenderType}`);
        console.log(`[vite-remote-types] Detected framework: ${detectedFramework}`);
        
        if (manifest.frameworkVersion) {
          console.log(`[vite-remote-types] Framework version: ${manifest.frameworkVersion}`);
        }
        
        // Log overrides
        if (renderType) {
          console.log(`[vite-remote-types] Render type explicitly set to: ${renderType}`);
        }
        
        if (framework) {
          console.log(`[vite-remote-types] Framework explicitly set to: ${framework}`);
        }
      }
      
      // Apply SSR configuration if needed
      if (detectedRenderType === 'ssr' && !config.build?.ssr) {
        console.log('[vite-remote-types] SSR detected, configuring Vite for SSR capabilities');
        
        // We can't modify the config directly, but we can log suggestions
        if (logDetectionResults) {
          console.log('[vite-remote-types] Recommendation: Add build.ssr = true to your Vite config for better SSR support');
        }
      }
    },
    
    // Add hooks to expose the manifest
    resolveId(id) {
      if (!enabled) return null;
      
      if (id === 'virtual:remote-types') {
        return '\0virtual:remote-types';
      }
      return null;
    },
    
    load(id) {
      if (!enabled) return null;
      
      if (id === '\0virtual:remote-types') {
        return `export default ${JSON.stringify(manifest)}`;
      }
      return null;
    },
    
    // Generate manifest file at build time
    closeBundle() {
      if (!enabled || !outputManifest) return;
      
      try {
        // Ensure output directory exists
        const outputDir = resolvedConfig.build?.outDir || 'dist';
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Write manifest file
        const manifestPath = path.join(outputDir, manifestFilename);
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        
        if (logDetectionResults) {
          console.log(`[vite-remote-types] Manifest file written to: ${manifestPath}`);
        }
      } catch (error) {
        console.error('[vite-remote-types] Failed to write manifest file:', error);
      }
    },
    
    // Provide custom config hooks for SSR detection
    config(config, { command }) {
      if (!enabled) return config;
      
      // Read package.json if not done yet
      if (!manifest.renderType) {
        let packageJson = {};
        try {
          const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
          packageJson = JSON.parse(packageJsonContent);
          
          // Apply remote type detection
          manifest = RemoteTypeIntegration.applyRemoteTypeToManifest({}, packageJson);
          detectedRenderType = manifest.renderType;
          detectedFramework = manifest.framework;
        } catch (error) {
          console.warn(`[vite-remote-types] Failed to read package.json at ${packageJsonPath}:`, error);
        }
      }
      
      // Suggest SSR configuration if detected as SSR
      if (detectedRenderType === 'ssr') {
        // For Next.js and similar frameworks
        if (['nextjs', 'remix', 'gatsby'].includes(detectedFramework)) {
          return {
            ...config,
            // Add SSR-friendly defaults
            ssr: {
              noExternal: true,
              ...config.ssr
            }
          };
        }
      }
      
      return config;
    }
  };
}

/**
 * Helper for using remote types in runtime code
 * 
 * @example
 * // Import directly in your code
 * import remoteTypes from 'virtual:remote-types';
 * 
 * // Use render type and framework info
 * if (remoteTypes.renderType === 'ssr') {
 *   // SSR-specific code
 * }
 */