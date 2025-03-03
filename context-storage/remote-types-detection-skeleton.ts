/**
 * Remote Types Detection - Skeleton
 * 
 * This file contains the skeleton implementation for the Remote Types Detection functionality.
 * Following TDD approach, this contains just enough structure to make the tests compile,
 * but the implementation is minimal to ensure tests fail initially.
 */

/**
 * Type definitions for render types
 */
export type RenderType = 'csr' | 'ssr' | 'universal';
export type FrameworkType = 'nextjs' | 'remix' | 'gatsby' | 'cra' | 'vite-react' | 'vite-vue' | 'angular' | 'unknown';

/**
 * RemoteTypeDetector - Core detection logic for different signals
 */
export class RemoteTypeDetector {
  /**
   * SSR dependencies that indicate server-side rendering
   * @private
   */
  private static SSR_DEPENDENCIES = [
    'next',
    '@remix-run/react',
    '@remix-run/node',
    'gatsby',
    'nuxt',
    'vite-plugin-ssr',
    '@vite-plugin/ssr',
    'react-server-components',
    'astro',
    'sveltekit',
    '@nestjs/core'
  ];

  /**
   * CSR dependencies that indicate client-side rendering
   * @private
   */
  private static CSR_DEPENDENCIES = [
    'react-scripts',
    'create-react-app',
    'parcel',
    'webpack-dev-server'
  ];

  /**
   * Detects render type from dependencies in package.json
   * Looks for specific dependencies that indicate SSR or CSR
   */
  static detectFromDependencies(dependencies: Record<string, string>): RenderType {
    if (!dependencies || typeof dependencies !== 'object') {
      return 'csr'; // Default to CSR if no dependencies
    }

    // Check for SSR dependencies
    for (const ssrDep of this.SSR_DEPENDENCIES) {
      if (dependencies[ssrDep]) {
        return 'ssr';
      }
    }

    // Check for SSR-specific Vite plugins even when Vite itself is typically CSR
    if (dependencies['vite'] && (
      dependencies['vite-plugin-ssr'] || 
      dependencies['@vitejs/plugin-ssr']
    )) {
      return 'ssr';
    }

    // Check for CSR dependencies
    for (const csrDep of this.CSR_DEPENDENCIES) {
      if (dependencies[csrDep]) {
        return 'csr';
      }
    }

    // Default to CSR when no specific indicators are found
    return 'csr';
  }

  /**
   * Detects render type from bundler configuration
   * Analyzes configuration for SSR-specific settings
   */
  static detectFromConfiguration(config: any): RenderType {
    if (!config || typeof config !== 'object') {
      return 'csr'; // Default to CSR if no config
    }

    // Next.js SSR configuration
    if (config.output?.serverComponents || 
        (config.name?.includes('next') && config.output?.path?.includes('server'))) {
      return 'ssr';
    }

    // Vite SSR configuration
    if (config.ssr || 
        (config.plugins && Array.isArray(config.plugins) && 
         config.plugins.some((plugin: any) => 
           plugin?.name?.includes('ssr') || plugin?.name?.includes('server')
         ))) {
      return 'ssr';
    }

    // Webpack/Rspack SSR configuration (Node target)
    if (config.target === 'node' || 
        (config.output?.libraryTarget === 'commonjs2' && !config.target?.includes('web'))) {
      return 'ssr';
    }

    // Webpack/Rspack CSR configuration (Web target)
    if (config.target === 'web' || config.target?.includes('browser')) {
      return 'csr';
    }

    // Default to CSR when no specific configuration is found
    return 'csr';
  }

  /**
   * SSR entrypoint indicators
   * @private
   */
  private static SSR_ENTRYPOINTS = [
    'server.js',
    'ssr.js',
    'server.ts',
    'ssr.ts',
    'serverEntry.js',
    'serverEntry.ts',
    'node.js',
    'node.ts',
    'server-entry.js',
    'server-entry.ts'
  ];

  /**
   * Detects render type from entrypoint files
   * Looks for server-side specific entry points
   */
  static detectFromEntrypoints(entrypoints: string[]): RenderType {
    if (!entrypoints || !Array.isArray(entrypoints) || entrypoints.length === 0) {
      return 'csr'; // Default to CSR if no entrypoints
    }

    // Check for SSR-specific entrypoint
    for (const entry of entrypoints) {
      const normalized = entry.toLowerCase();
      if (this.SSR_ENTRYPOINTS.some(ssrEntry => normalized.endsWith(ssrEntry))) {
        return 'ssr';
      }
    }

    // Default to CSR when no SSR entrypoints are found
    return 'csr';
  }
}

/**
 * RemoteTypeConfig - Configuration parsing and validation
 */
export class RemoteTypeConfig {
  /**
   * Valid render types
   * @private
   */
  private static VALID_RENDER_TYPES: RenderType[] = ['csr', 'ssr', 'universal'];

  /**
   * Parses and validates configuration options for render type
   * Validates that the render type is one of the allowed values
   * Falls back to detected type or CSR if not specified
   */
  static parseConfig(config: any, detectedType?: RenderType): RenderType {
    if (!config || typeof config !== 'object') {
      return detectedType || 'csr';
    }

    // Check if render type is explicitly specified
    if (config.renderType) {
      const configuredType = config.renderType as string;
      
      // Validate the render type
      if (!this.VALID_RENDER_TYPES.includes(configuredType as RenderType)) {
        throw new Error(`Invalid render type: ${configuredType}. Valid values are: ${this.VALID_RENDER_TYPES.join(', ')}`);
      }
      
      return configuredType as RenderType;
    }

    // Fall back to detected type or CSR
    return detectedType || 'csr';
  }
}

/**
 * RemoteTypeManifest - Manifest integration and type information
 */
export class RemoteTypeManifest {
  /**
   * Adds render type information to manifest
   * Creates a copy of the manifest with renderType field added
   * Optionally adds detection confidence level
   */
  static addTypeToManifest(manifest: any, renderType: RenderType, confidence?: number): any {
    // Create a copy of the manifest to avoid modifying the original
    const result = { ...manifest };
    
    // Add the render type
    result.renderType = renderType;
    
    // Add confidence level if provided
    if (confidence !== undefined) {
      result.detectionConfidence = confidence;
    }
    
    return result;
  }
}

/**
 * FrameworkDetector - Framework-specific detection and defaults
 */
export class FrameworkDetector {
  /**
   * Framework dependency matchers
   */
  static readonly FRAMEWORK_MATCHERS: Record<FrameworkType, string[]> = {
    'nextjs': ['next'],
    'remix': ['@remix-run/react', '@remix-run/node'],
    'gatsby': ['gatsby'],
    'cra': ['react-scripts', 'create-react-app'],
    'vite-react': ['vite', '@vitejs/plugin-react'],
    'vite-vue': ['vite', '@vitejs/plugin-vue'],
    'angular': ['@angular/core', '@angular/cli'],
    'unknown': []
  };

  /**
   * Framework default render types
   * @private
   */
  private static FRAMEWORK_RENDER_TYPES: Record<FrameworkType, RenderType> = {
    'nextjs': 'ssr',
    'remix': 'ssr',
    'gatsby': 'ssr',
    'cra': 'csr',
    'vite-react': 'csr',
    'vite-vue': 'csr',
    'angular': 'csr',
    'unknown': 'csr'
  };

  /**
   * Detects framework from dependencies
   * Analyzes package.json dependencies to identify the framework
   */
  static detectFramework(dependencies: Record<string, string>): FrameworkType {
    if (!dependencies || typeof dependencies !== 'object') {
      return 'unknown';
    }

    // Check each framework's dependencies
    for (const [framework, matchers] of Object.entries(this.FRAMEWORK_MATCHERS)) {
      if (framework === 'unknown') continue;

      const isMatch = matchers.some(dep => dependencies[dep] !== undefined);
      
      // Special case for Vite frameworks (need both Vite and specific plugin)
      if (framework === 'vite-react' || framework === 'vite-vue') {
        const hasVite = dependencies['vite'] !== undefined;
        const hasPlugin = matchers.slice(1).some(dep => dependencies[dep] !== undefined);
        
        if (hasVite && hasPlugin) {
          return framework as FrameworkType;
        }
      }
      // For other frameworks, any matching dependency is enough
      else if (isMatch) {
        return framework as FrameworkType;
      }
    }

    return 'unknown';
  }

  /**
   * Gets default render type for a framework
   * Returns the default rendering approach for a given framework
   */
  static getFrameworkDefaultRenderType(framework: FrameworkType): RenderType {
    return this.FRAMEWORK_RENDER_TYPES[framework] || 'csr';
  }
}

/**
 * RemoteTypeIntegration - High-level integration and conflict resolution
 */
export class RemoteTypeIntegration {
  /**
   * Detection result with confidence
   * @private
   */
  private static readonly FRAMEWORK_MATCHERS = FrameworkDetector.FRAMEWORK_MATCHERS;

  /**
   * Determines remote type from multiple sources
   * Combines and prioritizes different detection methods
   * Resolves conflicts using confidence levels
   */
  static determineRemoteType(
    packageJson: any,
    config: any,
    bundlerConfig?: any,
    entrypoints?: string[]
  ): RenderType {
    // Check for explicit configuration first (highest priority)
    try {
      const explicitType = RemoteTypeConfig.parseConfig(config);
      if (explicitType && config?.renderType) {
        return explicitType;
      }
    } catch (error) {
      console.warn('Invalid render type configuration:', error);
    }

    // Collect results from different detection methods
    const detectionResults: Array<{renderType: RenderType, confidence: number}> = [];

    // Detect from package.json dependencies
    if (packageJson?.dependencies) {
      const depType = RemoteTypeDetector.detectFromDependencies(packageJson.dependencies);
      detectionResults.push({
        renderType: depType,
        confidence: 0.7 // Dependencies are fairly reliable indicators
      });
    }

    // Detect from bundler configuration
    if (bundlerConfig) {
      const configType = RemoteTypeDetector.detectFromConfiguration(bundlerConfig);
      detectionResults.push({
        renderType: configType,
        confidence: 0.8 // Configuration is a strong indicator
      });
    }

    // Detect from entrypoints
    if (entrypoints && entrypoints.length > 0) {
      const entryType = RemoteTypeDetector.detectFromEntrypoints(entrypoints);
      detectionResults.push({
        renderType: entryType,
        confidence: 0.6 // Entrypoint naming is less reliable
      });
    }

    // Detect from framework
    if (packageJson?.dependencies) {
      const framework = FrameworkDetector.detectFramework(packageJson.dependencies);
      if (framework !== 'unknown') {
        const frameworkType = FrameworkDetector.getFrameworkDefaultRenderType(framework);
        detectionResults.push({
          renderType: frameworkType,
          confidence: 0.5 // Framework default is a moderate indicator
        });
      }
    }

    // If no results, default to CSR
    if (detectionResults.length === 0) {
      return 'csr';
    }

    // Count votes for each render type, weighted by confidence
    const votes: Record<RenderType, number> = {
      'csr': 0,
      'ssr': 0,
      'universal': 0
    };

    for (const result of detectionResults) {
      votes[result.renderType] += result.confidence;
    }

    // Find the render type with the highest confidence score
    let maxVotes = 0;
    let detectedType: RenderType = 'csr';

    for (const [renderType, score] of Object.entries(votes)) {
      if (score > maxVotes) {
        maxVotes = score;
        detectedType = renderType as RenderType;
      }
    }

    return detectedType;
  }

  /**
   * Applies remote type and framework info to manifest
   * Enhances manifest with framework details and render type
   */
  static applyRemoteTypeToManifest(manifest: any, packageJson: any): any {
    // Create a copy of the manifest
    const result = { ...manifest };
    
    // Detect framework
    const framework = FrameworkDetector.detectFramework(packageJson?.dependencies || {});
    
    // Determine render type
    const renderType = this.determineRemoteType(packageJson, manifest);
    
    // Add framework info
    result.framework = framework;
    
    // Add framework version if available
    if (framework !== 'unknown' && packageJson?.dependencies) {
      const frameworkDep = FrameworkDetector.FRAMEWORK_MATCHERS[framework][0];
      if (frameworkDep && packageJson.dependencies[frameworkDep]) {
        result.frameworkVersion = packageJson.dependencies[frameworkDep];
      }
    }
    
    // Add render type
    result.renderType = renderType;
    
    return result;
  }
}