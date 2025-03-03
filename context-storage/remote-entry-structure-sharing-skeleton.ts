/**
 * Remote Entry Structure Sharing - Implementation
 * 
 * This file contains the implementation for the Remote Entry Structure Sharing functionality.
 * This enables metadata sharing between federated modules for better integration.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Type definitions for metadata
 */
export interface RemoteMetadata {
  schemaVersion: string;
  moduleFederationVersion: string;
  renderType: 'csr' | 'ssr' | 'universal';
  framework: string;
  frameworkVersion?: string;
  dependencies?: Record<string, string>;
  exports?: Record<string, {
    import: string;
    types?: string;
  }>;
}

/**
 * Compatibility validation result
 */
export interface CompatibilityResult {
  compatible: boolean;
  issues: string[];
  warnings: string[];
}

/**
 * MetadataSchema - Schema definition and validation for structure metadata
 */
export class MetadataSchema {
  // Valid render types
  private static readonly VALID_RENDER_TYPES = ['csr', 'ssr', 'universal'];
  
  // Required fields in metadata
  private static readonly REQUIRED_FIELDS = ['schemaVersion', 'moduleFederationVersion', 'renderType', 'framework'];

  /**
   * Validates metadata against schema requirements
   */
  static validateMetadata(metadata: any): boolean {
    // Check if required fields exist
    for (const field of this.REQUIRED_FIELDS) {
      if (metadata[field] === undefined) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate render type
    if (!this.VALID_RENDER_TYPES.includes(metadata.renderType)) {
      throw new Error(`Invalid renderType: ${metadata.renderType}. Must be one of: ${this.VALID_RENDER_TYPES.join(', ')}`);
    }

    // Validate version formats
    if (!this.isValidVersionFormat(metadata.schemaVersion)) {
      throw new Error(`Invalid schemaVersion format: ${metadata.schemaVersion}`);
    }

    if (!this.isValidVersionFormat(metadata.moduleFederationVersion)) {
      throw new Error(`Invalid moduleFederationVersion format: ${metadata.moduleFederationVersion}`);
    }

    // Validate frameworkVersion if present
    if (metadata.frameworkVersion && !this.isValidVersionFormat(metadata.frameworkVersion, true)) {
      throw new Error(`Invalid frameworkVersion format: ${metadata.frameworkVersion}`);
    }

    // Validate dependencies if present
    if (metadata.dependencies) {
      for (const [dep, version] of Object.entries(metadata.dependencies)) {
        if (!this.isValidVersionFormat(version as string, true)) {
          throw new Error(`Invalid version format for dependency ${dep}: ${version}`);
        }
      }
    }

    // Validate exports if present
    if (metadata.exports) {
      for (const [key, value] of Object.entries(metadata.exports)) {
        if (!key.startsWith('./')) {
          throw new Error(`Export key must start with './': ${key}`);
        }
        
        const exportDef = value as any;
        if (!exportDef.import) {
          throw new Error(`Export ${key} is missing 'import' field`);
        }
      }
    }

    return true;
  }

  /**
   * Validates version format, optionally allowing semver ranges
   */
  private static isValidVersionFormat(version: string, allowRange = false): boolean {
    // Simple semver regex
    const semverRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z-.]+)?(\+[0-9A-Za-z-.]+)?$/;
    
    // Semver range regex
    const rangeRegex = /^(\^|~|>=|<=|>|<|=)?\d+\.\d+\.\d+(-[0-9A-Za-z-.]+)?(\+[0-9A-Za-z-.]+)?$/;
    
    if (allowRange) {
      return rangeRegex.test(version);
    }
    
    return semverRegex.test(version);
  }

  /**
   * Creates default metadata with optional overrides
   */
  static createDefaultMetadata(overrides?: Partial<RemoteMetadata>): RemoteMetadata {
    return {
      schemaVersion: '1.0.0',
      moduleFederationVersion: '1.0.0',
      renderType: 'csr',
      framework: 'unknown',
      ...overrides
    };
  }
}

/**
 * MetadataExtractor - Extraction of metadata from packages and bundler configs
 */
export class MetadataExtractor {
  // Framework detection patterns
  private static readonly FRAMEWORK_PATTERNS = [
    { dep: 'next', framework: 'nextjs', renderType: 'ssr' },
    { dep: 'remix', framework: 'remix', renderType: 'ssr' },
    { dep: 'gatsby', framework: 'gatsby', renderType: 'ssr' },
    { dep: '@angular/core', framework: 'angular', renderType: 'csr' },
    { dep: 'vue', framework: 'vue', renderType: 'csr' },
    { dep: 'react', framework: 'react', renderType: 'csr' },
    { dep: 'svelte', framework: 'svelte', renderType: 'csr' }
  ];

  // Module Federation version detection patterns
  private static readonly MF_VERSION_PATTERNS = [
    { dep: '@module-federation/enhanced', version: '2.0.0' },
    { dep: '@module-federation/runtime', version: '2.0.0' },
    { dep: '@module-federation/node', version: '2.0.0' }
  ];

  /**
   * Extracts metadata from package.json and optionally bundler config
   */
  static extractFromPackage(packageJson: any, bundlerConfig?: any): RemoteMetadata {
    const baseMetadata = MetadataSchema.createDefaultMetadata();
    
    // Extract framework and renderType based on dependencies
    if (packageJson.dependencies) {
      for (const { dep, framework, renderType } of this.FRAMEWORK_PATTERNS) {
        if (packageJson.dependencies[dep]) {
          baseMetadata.framework = framework;
          baseMetadata.renderType = renderType;
          baseMetadata.frameworkVersion = packageJson.dependencies[dep];
          break;
        }
      }
    }
    
    // Extract Module Federation version
    if (packageJson.dependencies) {
      for (const { dep, version } of this.MF_VERSION_PATTERNS) {
        if (packageJson.dependencies[dep]) {
          baseMetadata.moduleFederationVersion = version;
          break;
        }
      }
    }
    
    // Include dependencies
    if (packageJson.dependencies) {
      baseMetadata.dependencies = { ...packageJson.dependencies };
    }
    
    // Extract exports if defined in package.json
    if (packageJson.exports) {
      baseMetadata.exports = {};
      
      for (const [key, value] of Object.entries(packageJson.exports)) {
        if (typeof value === 'string') {
          baseMetadata.exports[key] = { import: value };
        } else if (typeof value === 'object' && value !== null) {
          baseMetadata.exports[key] = { import: (value as any).import || value };
          
          // Include types if available
          if ((value as any).types) {
            baseMetadata.exports[key].types = (value as any).types;
          }
        }
      }
    }
    
    // Merge with bundler config metadata if provided
    if (bundlerConfig) {
      const bundlerMetadata = this.extractFromBundlerConfig(bundlerConfig);
      
      // Only override if a value is present in bundlerMetadata
      Object.entries(bundlerMetadata).forEach(([key, value]) => {
        if (value !== undefined) {
          (baseMetadata as any)[key] = value;
        }
      });
    }
    
    return baseMetadata;
  }

  /**
   * Extracts metadata from bundler configuration
   */
  static extractFromBundlerConfig(bundlerConfig: any): Partial<RemoteMetadata> {
    const metadata: Partial<RemoteMetadata> = {};
    
    // Detect Module Federation version from plugins
    if (bundlerConfig.plugins) {
      for (const plugin of bundlerConfig.plugins) {
        // Check plugin name for MF version detection
        const pluginName = plugin.constructor?.name || plugin.name;
        
        if (pluginName === 'ModuleFederationPlugin') {
          metadata.moduleFederationVersion = '1.0.0';
          
          // Extract exports from MF 1.0 config
          if (plugin._options?.exposes) {
            metadata.exports = {};
            
            Object.entries(plugin._options.exposes).forEach(([key, value]) => {
              metadata.exports![key] = { import: value as string };
            });
          }
        } else if (['EasyFederationPlugin', 'FederationPlugin'].includes(pluginName)) {
          metadata.moduleFederationVersion = '2.0.0';
          
          // Extract exports from MF 2.0 config
          if (plugin._options?.exposes) {
            metadata.exports = {};
            
            // Handle array format for MF 2.0
            if (Array.isArray(plugin._options.exposes)) {
              plugin._options.exposes.forEach((expose: any) => {
                const key = expose.remote;
                metadata.exports![key] = { import: expose.entry };
                
                if (expose.types) {
                  metadata.exports![key].types = expose.types;
                }
              });
            }
          }
        }
      }
    }
    
    // Detect renderType from target
    if (bundlerConfig.target) {
      const target = Array.isArray(bundlerConfig.target) 
        ? bundlerConfig.target[0] 
        : bundlerConfig.target;
      
      if (target === 'node' || target === 'server') {
        metadata.renderType = 'ssr';
      }
    }
    
    return metadata;
  }
}

/**
 * MetadataPublisher - Publishing of metadata alongside remoteEntry files
 */
export class MetadataPublisher {
  /**
   * Publishes metadata file alongside remoteEntry
   */
  static publishMetadata(metadata: RemoteMetadata, outputPath: string, remoteEntryFilename: string): string {
    // Create metadata filename by replacing .js with .metadata.json
    const metadataFilename = remoteEntryFilename.replace(/\.js$/, '.metadata.json');
    const metadataFilePath = path.join(outputPath, metadataFilename);
    
    // Ensure output directory exists
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
    
    // Write metadata file
    fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2));
    
    return metadataFilePath;
  }

  /**
   * Gets metadata URL from remoteEntry URL
   */
  static getMetadataUrl(remoteUrl: string): string {
    // Parse URL to handle correctly
    let url = remoteUrl;
    let queryString = '';
    
    // Extract query string if present
    const queryIndex = remoteUrl.indexOf('?');
    if (queryIndex > -1) {
      url = remoteUrl.substring(0, queryIndex);
      queryString = remoteUrl.substring(queryIndex);
    }
    
    // Replace .js with .metadata.json and reattach query string
    return url.replace(/\.js$/, '.metadata.json') + queryString;
  }
}

/**
 * MetadataConsumer - Consumption and compatibility validation of remote metadata
 */
export class MetadataConsumer {
  // In-memory cache for metadata
  private static metadataCache: Record<string, RemoteMetadata> = {};

  /**
   * Fetches metadata from a remote URL
   */
  static async fetchMetadata(remoteUrl: string): Promise<RemoteMetadata> {
    // Check cache first
    if (this.metadataCache[remoteUrl]) {
      return this.metadataCache[remoteUrl];
    }
    
    // Get metadata URL
    const metadataUrl = MetadataPublisher.getMetadataUrl(remoteUrl);
    
    try {
      // Fetch metadata
      const response = await fetch(metadataUrl);
      
      if (!response.ok) {
        console.warn(`Failed to fetch metadata from ${metadataUrl} (${response.status})`);
        return MetadataSchema.createDefaultMetadata();
      }
      
      const metadata = await response.json();
      
      // Validate and store in cache
      if (MetadataSchema.validateMetadata(metadata)) {
        this.metadataCache[remoteUrl] = metadata;
        return metadata;
      }
    } catch (error) {
      console.warn(`Error fetching metadata from ${metadataUrl}:`, error);
    }
    
    // Return default metadata if fetch fails
    return MetadataSchema.createDefaultMetadata();
  }

  /**
   * Validates compatibility between host and remote metadata
   */
  static validateCompatibility(hostMetadata: RemoteMetadata, remoteMetadata: RemoteMetadata): CompatibilityResult {
    const result: CompatibilityResult = {
      compatible: true,
      issues: [],
      warnings: []
    };
    
    // Check renderType compatibility
    if (hostMetadata.renderType !== remoteMetadata.renderType) {
      // CSR host can't use SSR remotes
      if (hostMetadata.renderType === 'csr' && remoteMetadata.renderType === 'ssr') {
        result.compatible = false;
        result.issues.push(`renderType mismatch: host is csr, remote is ssr`);
      } 
      // SSR host with CSR remote is fine but warn
      else if (hostMetadata.renderType === 'ssr' && remoteMetadata.renderType === 'csr') {
        result.warnings.push(`renderType mismatch: host is ssr, remote is csr`);
      }
      // Universal is compatible with anything
      else if (hostMetadata.renderType !== 'universal' && remoteMetadata.renderType !== 'universal') {
        result.warnings.push(`renderType mismatch: host is ${hostMetadata.renderType}, remote is ${remoteMetadata.renderType}`);
      }
    }
    
    // Check framework compatibility
    if (hostMetadata.framework !== remoteMetadata.framework && 
        hostMetadata.framework !== 'unknown' && 
        remoteMetadata.framework !== 'unknown') {
      result.warnings.push(`framework mismatch: host is ${hostMetadata.framework}, remote is ${remoteMetadata.framework}`);
    }
    
    // Check dependency compatibility
    if (hostMetadata.dependencies && remoteMetadata.dependencies) {
      for (const [dep, hostVersion] of Object.entries(hostMetadata.dependencies)) {
        const remoteVersion = remoteMetadata.dependencies[dep];
        
        if (remoteVersion && hostVersion !== remoteVersion) {
          result.warnings.push(`${dep} version mismatch: host ${hostVersion}, remote ${remoteVersion}`);
        }
      }
    }
    
    return result;
  }
}

/**
 * RemoteStructureSharingIntegration - High-level integration with bundlers
 */
export class RemoteStructureSharingIntegration {
  /**
   * Sets up bundler plugin for metadata publishing
   */
  static setupBundlerPlugin(bundlerConfig: any, packageJson: any): any {
    // Create a deep copy of the config to avoid modifying the original
    const config = JSON.parse(JSON.stringify(bundlerConfig));
    
    // Detect bundler type
    const isWebpack = config.plugins?.some((p: any) => 
      (p.constructor?.name === 'ModuleFederationPlugin') || 
      (p.constructor?.name === 'EasyFederationPlugin')
    );
    
    if (isWebpack) {
      // Extract metadata
      const metadata = MetadataExtractor.extractFromPackage(packageJson, config);
      
      // Create and add metadata publisher plugin
      const metadataPublisherPlugin = {
        name: 'MetadataPublisherPlugin',
        apply: (compiler: any) => {
          compiler.hooks.afterEmit.tap('MetadataPublisherPlugin', (compilation: any) => {
            // Find Module Federation plugin
            const mfPlugin = config.plugins.find((p: any) => 
              (p.constructor?.name === 'ModuleFederationPlugin') || 
              (p.constructor?.name === 'EasyFederationPlugin')
            );
            
            if (mfPlugin) {
              const outputPath = compilation.outputOptions.path;
              const filename = mfPlugin._options.filename || 'remoteEntry.js';
              
              // Publish metadata
              MetadataPublisher.publishMetadata(metadata, outputPath, filename);
            }
          });
        }
      };
      
      // Add plugin to config
      config.plugins.push(metadataPublisherPlugin);
    } 
    // Handle Vite
    else if (config.plugins?.some((p: any) => p.name?.includes('vite:'))) {
      // Extract metadata
      const metadata = MetadataExtractor.extractFromPackage(packageJson, config);
      
      // Create metadata publisher plugin
      const metadataPublisherPlugin = {
        name: 'metadata-publisher',
        closeBundle: () => {
          const outputPath = config.build?.outDir || 'dist';
          // Assume standard remoteEntry name for Vite
          MetadataPublisher.publishMetadata(metadata, outputPath, 'remoteEntry.js');
        }
      };
      
      // Add plugin to config
      config.plugins.push(metadataPublisherPlugin);
    }
    
    return config;
  }

  /**
   * Sets up bundler plugin for metadata consumption
   */
  static setupConsumerPlugin(bundlerConfig: any): any {
    // Create a deep copy of the config to avoid modifying the original
    const config = JSON.parse(JSON.stringify(bundlerConfig));
    
    // Extract remote URLs
    const remoteUrls: string[] = [];
    
    // Check plugins for Module Federation
    if (config.plugins) {
      // Find Module Federation plugin
      const mfPlugin = config.plugins.find((p: any) => 
        (p.constructor?.name === 'ModuleFederationPlugin') || 
        (p.constructor?.name === 'EasyFederationPlugin')
      );
      
      if (mfPlugin) {
        // Extract remotes based on MF version
        if (mfPlugin.constructor?.name === 'ModuleFederationPlugin') {
          // MF 1.0 format
          if (mfPlugin._options?.remotes) {
            // Format: { remote1: 'remote1@https://example.com/remote1/remoteEntry.js' }
            Object.values(mfPlugin._options.remotes).forEach((remoteString: any) => {
              const urlMatch = remoteString.match(/@(.+?)$/);
              if (urlMatch) {
                remoteUrls.push(urlMatch[1]);
              }
            });
          }
        } else if (mfPlugin.constructor?.name === 'EasyFederationPlugin') {
          // MF 2.0 format
          if (mfPlugin._options?.remotes && Array.isArray(mfPlugin._options.remotes)) {
            // Format: [{ name: 'remote1', entry: 'https://example.com/remote1/remoteEntry.js' }]
            mfPlugin._options.remotes.forEach((remote: any) => {
              if (remote.entry) {
                remoteUrls.push(remote.entry);
              }
            });
          }
        }
      }
    }
    
    // Create and add metadata consumer plugin
    if (remoteUrls.length > 0) {
      const metadataConsumerPlugin = {
        name: 'MetadataConsumerPlugin',
        remotes: remoteUrls,
        apply: (compiler: any) => {
          compiler.hooks.beforeCompile.tapAsync('MetadataConsumerPlugin', async (params: any, callback: Function) => {
            try {
              // Extract host metadata
              const hostMetadata = MetadataExtractor.extractFromBundlerConfig(config);
              
              // Log validation messages
              console.log('Remote compatibility validation:');
              
              // Validate compatibility for each remote
              for (const remoteUrl of remoteUrls) {
                const remoteMetadata = await MetadataConsumer.fetchMetadata(remoteUrl);
                const result = MetadataConsumer.validateCompatibility(
                  MetadataSchema.createDefaultMetadata(hostMetadata), 
                  remoteMetadata
                );
                
                console.log(`- ${remoteUrl}:`);
                if (!result.compatible) {
                  console.warn(`  INCOMPATIBLE: ${result.issues.join(', ')}`);
                } else if (result.warnings.length > 0) {
                  console.warn(`  Warnings: ${result.warnings.join(', ')}`);
                } else {
                  console.log('  Compatible');
                }
              }
            } catch (error) {
              console.error('Error in MetadataConsumerPlugin:', error);
            }
            
            callback();
          });
        }
      };
      
      // Add plugin to config
      config.plugins.push(metadataConsumerPlugin);
    }
    
    return config;
  }

  /**
   * Validates compatibility of remotes with host
   */
  static async validateRemoteCompatibility(
    hostMetadata: RemoteMetadata, 
    remotes: Record<string, string>
  ): Promise<Record<string, CompatibilityResult>> {
    const results: Record<string, CompatibilityResult> = {};
    
    // Process each remote
    for (const [remoteName, remoteUrl] of Object.entries(remotes)) {
      // Extract URL from remote string
      const urlMatch = remoteUrl.match(/@(.+?)$/);
      if (!urlMatch) continue;
      
      const url = urlMatch[1];
      
      // Fetch and validate
      const remoteMetadata = await MetadataConsumer.fetchMetadata(url);
      results[remoteName] = MetadataConsumer.validateCompatibility(hostMetadata, remoteMetadata);
    }
    
    return results;
  }
}