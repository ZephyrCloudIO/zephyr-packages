/**
 * FeatureDetector - Core utility for detecting frameworks, render types, and bundlers
 * 
 * This abstraction centralizes all detection functionality to eliminate 
 * duplication between different implementations.
 */

/**
 * Render type enum
 */
export type RenderType = 'csr' | 'ssr' | 'universal';

/**
 * Framework type enum
 */
export type FrameworkType = 
  | 'nextjs' 
  | 'remix' 
  | 'gatsby' 
  | 'cra' 
  | 'vite-react' 
  | 'vite-vue' 
  | 'angular' 
  | 'vue' 
  | 'react' 
  | 'svelte' 
  | 'unknown';

/**
 * Bundler type enum
 */
export type BundlerType = 
  | 'webpack' 
  | 'rspack' 
  | 'vite' 
  | 'rollup' 
  | 'rolldown' 
  | 'parcel' 
  | 'unknown';

/**
 * Module Federation version
 */
export type MFVersion = '1.0' | '2.0' | 'unknown';

/**
 * Framework info interface
 */
export interface FrameworkInfo {
  /**
   * Default render type for the framework
   */
  defaultRenderType: RenderType;
  
  /**
   * Key dependencies for the framework
   */
  dependencies: string[];
  
  /**
   * Framework type identifier
   */
  type: FrameworkType;
}

/**
 * Detection result with confidence
 */
export interface DetectionResult<T> {
  /**
   * Detected value
   */
  value: T;
  
  /**
   * Confidence level (0-1)
   */
  confidence: number;
  
  /**
   * Source of the detection
   */
  source: string;
}

/**
 * FeatureDetector - Main class for detecting various features
 */
export class FeatureDetector {
  /**
   * Framework detection patterns
   * @private
   */
  private static readonly FRAMEWORK_INFO: Record<FrameworkType, FrameworkInfo> = {
    'nextjs': {
      defaultRenderType: 'ssr',
      dependencies: ['next'],
      type: 'nextjs'
    },
    'remix': {
      defaultRenderType: 'ssr',
      dependencies: ['@remix-run/react', '@remix-run/node'],
      type: 'remix'
    },
    'gatsby': {
      defaultRenderType: 'ssr',
      dependencies: ['gatsby'],
      type: 'gatsby'
    },
    'cra': {
      defaultRenderType: 'csr',
      dependencies: ['react-scripts', 'create-react-app'],
      type: 'cra'
    },
    'vite-react': {
      defaultRenderType: 'csr',
      dependencies: ['vite', '@vitejs/plugin-react'],
      type: 'vite-react'
    },
    'vite-vue': {
      defaultRenderType: 'csr',
      dependencies: ['vite', '@vitejs/plugin-vue'],
      type: 'vite-vue'
    },
    'angular': {
      defaultRenderType: 'csr',
      dependencies: ['@angular/core', '@angular/cli'],
      type: 'angular'
    },
    'vue': {
      defaultRenderType: 'csr',
      dependencies: ['vue'],
      type: 'vue'
    },
    'react': {
      defaultRenderType: 'csr',
      dependencies: ['react', 'react-dom'],
      type: 'react'
    },
    'svelte': {
      defaultRenderType: 'csr',
      dependencies: ['svelte'],
      type: 'svelte'
    },
    'unknown': {
      defaultRenderType: 'csr',
      dependencies: [],
      type: 'unknown'
    }
  };

  /**
   * SSR dependencies that indicate server-side rendering
   * @private
   */
  private static readonly SSR_DEPENDENCIES = [
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
  private static readonly CSR_DEPENDENCIES = [
    'react-scripts',
    'create-react-app',
    'parcel',
    'webpack-dev-server'
  ];

  /**
   * SSR entrypoint indicators
   * @private
   */
  private static readonly SSR_ENTRYPOINTS = [
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
   * Module Federation version detection patterns
   * @private
   */
  private static readonly MF_VERSION_PATTERNS = [
    { dep: '@module-federation/enhanced', version: '2.0' },
    { dep: '@module-federation/runtime', version: '2.0' },
    { dep: '@module-federation/node', version: '2.0' },
    { plugin: 'ModuleFederationPlugin', version: '1.0' },
    { plugin: 'EasyFederationPlugin', version: '2.0' },
    { plugin: 'FederationPlugin', version: '2.0' }
  ];

  /**
   * Detects framework from dependencies
   * 
   * @param dependencies Dependencies object from package.json
   * @returns Detected framework type
   */
  static detectFramework(dependencies: Record<string, string>): FrameworkType {
    if (!dependencies || typeof dependencies !== 'object') {
      return 'unknown';
    }

    // Check each framework's dependencies
    for (const [framework, info] of Object.entries(this.FRAMEWORK_INFO)) {
      if (framework === 'unknown') continue;

      // For Vite frameworks (need both Vite and specific plugin)
      if (framework === 'vite-react' || framework === 'vite-vue') {
        const hasVite = dependencies['vite'] !== undefined;
        const hasPlugin = info.dependencies.slice(1).some(dep => dependencies[dep] !== undefined);
        
        if (hasVite && hasPlugin) {
          return info.type;
        }
      } 
      // For other frameworks, any matching dependency is enough
      else {
        const isMatch = info.dependencies.some(dep => dependencies[dep] !== undefined);
        if (isMatch) {
          return info.type;
        }
      }
    }

    return 'unknown';
  }

  /**
   * Gets framework info for a framework type
   * 
   * @param framework Framework type
   * @returns Framework info object
   */
  static getFrameworkInfo(framework: FrameworkType): FrameworkInfo {
    return this.FRAMEWORK_INFO[framework] || this.FRAMEWORK_INFO.unknown;
  }

  /**
   * Gets default render type for a framework
   * 
   * @param framework Framework type
   * @returns Default render type
   */
  static getFrameworkDefaultRenderType(framework: FrameworkType): RenderType {
    return this.getFrameworkInfo(framework).defaultRenderType;
  }

  /**
   * Detects render type from dependencies
   * 
   * @param dependencies Dependencies object from package.json
   * @returns Detected render type
   */
  static detectRenderTypeFromDependencies(dependencies: Record<string, string>): DetectionResult<RenderType> {
    if (!dependencies || typeof dependencies !== 'object') {
      return { 
        value: 'csr', 
        confidence: 0.3, 
        source: 'default' 
      };
    }

    // Check for SSR dependencies
    for (const ssrDep of this.SSR_DEPENDENCIES) {
      if (dependencies[ssrDep]) {
        return { 
          value: 'ssr', 
          confidence: 0.7, 
          source: `dependency:${ssrDep}` 
        };
      }
    }

    // Check for SSR-specific Vite plugins even when Vite itself is typically CSR
    if (dependencies['vite'] && (
      dependencies['vite-plugin-ssr'] || 
      dependencies['@vitejs/plugin-ssr']
    )) {
      return { 
        value: 'ssr', 
        confidence: 0.7, 
        source: 'dependency:vite-ssr-plugin' 
      };
    }

    // Check for CSR dependencies
    for (const csrDep of this.CSR_DEPENDENCIES) {
      if (dependencies[csrDep]) {
        return { 
          value: 'csr', 
          confidence: 0.7, 
          source: `dependency:${csrDep}` 
        };
      }
    }

    // Default to CSR when no specific indicators are found
    return { 
      value: 'csr', 
      confidence: 0.5, 
      source: 'default' 
    };
  }

  /**
   * Detects render type from bundler configuration
   * 
   * @param config Bundler configuration object
   * @returns Detected render type
   */
  static detectRenderTypeFromConfiguration(config: any): DetectionResult<RenderType> {
    if (!config || typeof config !== 'object') {
      return { 
        value: 'csr', 
        confidence: 0.3, 
        source: 'default' 
      };
    }

    // Next.js SSR configuration
    if (config.output?.serverComponents || 
        (config.name?.includes('next') && config.output?.path?.includes('server'))) {
      return { 
        value: 'ssr', 
        confidence: 0.8, 
        source: 'config:next-server' 
      };
    }

    // Vite SSR configuration
    if (config.ssr || 
        (config.plugins && Array.isArray(config.plugins) && 
          config.plugins.some((plugin: any) => 
            plugin?.name?.includes('ssr') || plugin?.name?.includes('server')
          ))) {
      return { 
        value: 'ssr', 
        confidence: 0.8, 
        source: 'config:vite-ssr' 
      };
    }

    // Webpack/Rspack SSR configuration (Node target)
    if (config.target === 'node' || 
        (config.output?.libraryTarget === 'commonjs2' && !config.target?.includes('web'))) {
      return { 
        value: 'ssr', 
        confidence: 0.8, 
        source: 'config:node-target' 
      };
    }

    // Webpack/Rspack CSR configuration (Web target)
    if (config.target === 'web' || config.target?.includes('browser')) {
      return { 
        value: 'csr', 
        confidence: 0.8, 
        source: 'config:web-target' 
      };
    }

    // Default to CSR when no specific configuration is found
    return { 
      value: 'csr', 
      confidence: 0.5, 
      source: 'default' 
    };
  }

  /**
   * Detects render type from entrypoints
   * 
   * @param entrypoints List of entrypoint file paths
   * @returns Detected render type
   */
  static detectRenderTypeFromEntrypoints(entrypoints: string[]): DetectionResult<RenderType> {
    if (!entrypoints || !Array.isArray(entrypoints) || entrypoints.length === 0) {
      return { 
        value: 'csr', 
        confidence: 0.3, 
        source: 'default' 
      };
    }

    // Check for SSR-specific entrypoint
    for (const entry of entrypoints) {
      const normalized = entry.toLowerCase();
      if (this.SSR_ENTRYPOINTS.some(ssrEntry => normalized.endsWith(ssrEntry))) {
        return { 
          value: 'ssr', 
          confidence: 0.6, 
          source: `entrypoint:${entry}` 
        };
      }
    }

    // Default to CSR when no SSR entrypoints are found
    return { 
      value: 'csr', 
      confidence: 0.5, 
      source: 'default' 
    };
  }

  /**
   * Detects render type from multiple sources
   * 
   * @param packageJson Package.json content
   * @param config Optional plugin configuration
   * @param bundlerConfig Optional bundler configuration
   * @param entrypoints Optional list of entrypoints
   * @returns Final detected render type
   */
  static detectRenderType(
    packageJson: any,
    config?: any,
    bundlerConfig?: any,
    entrypoints?: string[]
  ): RenderType {
    // Check for explicit configuration first (highest priority)
    if (config?.renderType && 
        ['csr', 'ssr', 'universal'].includes(config.renderType)) {
      return config.renderType as RenderType;
    }

    // Collect results from different detection methods
    const detectionResults: DetectionResult<RenderType>[] = [];

    // Detect from package.json dependencies
    if (packageJson?.dependencies) {
      detectionResults.push(
        this.detectRenderTypeFromDependencies(packageJson.dependencies)
      );
    }

    // Detect from bundler configuration
    if (bundlerConfig) {
      detectionResults.push(
        this.detectRenderTypeFromConfiguration(bundlerConfig)
      );
    }

    // Detect from entrypoints
    if (entrypoints && entrypoints.length > 0) {
      detectionResults.push(
        this.detectRenderTypeFromEntrypoints(entrypoints)
      );
    }

    // Detect from framework
    if (packageJson?.dependencies) {
      const framework = this.detectFramework(packageJson.dependencies);
      if (framework !== 'unknown') {
        const frameworkType = this.getFrameworkDefaultRenderType(framework);
        detectionResults.push({
          value: frameworkType,
          confidence: 0.5,
          source: `framework:${framework}`
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
      votes[result.value] += result.confidence;
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
   * Detects bundler type from configuration
   * 
   * @param config Bundler configuration object
   * @returns Detected bundler type
   */
  static detectBundlerType(config: any): BundlerType {
    if (!config || typeof config !== 'object') {
      return 'unknown';
    }

    // Check for webpack
    if (config.output?.path && typeof config.entry === 'object') {
      return 'webpack';
    }

    // Check for rspack (similar to webpack but with specific patterns)
    if (config.output?.path && 
        config.builtins && 
        typeof config.entry === 'object') {
      return 'rspack';
    }

    // Check for vite
    if (config.plugins?.some((p: any) => p.name?.includes('vite:'))) {
      return 'vite';
    }

    // Check for rollup
    if (config.plugins && 
        config.output && 
        !config.output.path && 
        config.output.file || 
        config.output.dir) {
      return 'rollup';
    }

    // Check for rolldown
    if (config.plugins && 
        config.input && 
        config.output?.format) {
      return 'rolldown';
    }

    // Check for parcel
    if (config.transformer && 
        config.resolver && 
        config.packager) {
      return 'parcel';
    }

    // Default to unknown
    return 'unknown';
  }

  /**
   * Detects Module Federation version
   * 
   * @param dependencies Dependencies object from package.json
   * @param config Optional bundler configuration
   * @returns Detected Module Federation version
   */
  static detectModuleFederationVersion(
    dependencies?: Record<string, string>,
    config?: any
  ): MFVersion {
    // Check dependencies first
    if (dependencies) {
      for (const { dep, version } of this.MF_VERSION_PATTERNS) {
        if (dep && dependencies[dep]) {
          return version as MFVersion;
        }
      }
    }

    // Check plugins in configuration
    if (config?.plugins) {
      for (const plugin of config.plugins) {
        const pluginName = plugin.constructor?.name || plugin.name;
        for (const { plugin: pluginPattern, version } of this.MF_VERSION_PATTERNS) {
          if (pluginPattern && pluginName === pluginPattern) {
            return version as MFVersion;
          }
        }
      }
    }

    return 'unknown';
  }

  /**
   * Checks if a plugin is a Module Federation plugin
   * 
   * @param plugin Plugin instance
   * @returns Whether the plugin is a Module Federation plugin
   */
  static isModuleFederationPlugin(plugin: any): boolean {
    if (!plugin) return false;
    
    const pluginName = plugin.constructor?.name || plugin.name;
    return [
      'ModuleFederationPlugin',
      'EasyFederationPlugin',
      'FederationPlugin'
    ].includes(pluginName);
  }

  /**
   * Gets Module Federation plugin from configuration
   * 
   * @param config Bundler configuration
   * @returns Module Federation plugin if found, null otherwise
   */
  static getModuleFederationPlugin(config: any): any {
    if (!config?.plugins || !Array.isArray(config.plugins)) {
      return null;
    }

    return config.plugins.find(plugin => this.isModuleFederationPlugin(plugin)) || null;
  }

  /**
   * Detects runtime environment
   * 
   * @returns Whether the code is running in a browser
   */
  static isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  /**
   * Detects Node.js environment
   * 
   * @returns Whether the code is running in Node.js
   */
  static isNode(): boolean {
    return typeof process !== 'undefined' && 
           process.versions != null && 
           process.versions.node != null;
  }

  /**
   * Detects ESM support
   * 
   * @returns Whether the environment supports ESM
   */
  static supportsESM(): boolean {
    try {
      // Try to evaluate dynamic import syntax
      new Function('return import("").catch(() => {})');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detects streaming support
   * 
   * @returns Whether the environment supports streaming
   */
  static supportsStreaming(): boolean {
    return typeof ReadableStream !== 'undefined' && 
           typeof WritableStream !== 'undefined';
  }
}