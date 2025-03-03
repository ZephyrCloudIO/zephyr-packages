/**
 * Runtime Plugin System Implementation
 * 
 * This module implements a comprehensive runtime plugin system to support
 * Module Federation 2.0 plugins in Zephyr packages.
 */

/**
 * Plugin Interface and Type Definitions
 */

/**
 * Runtime Plugin Interface
 */
export interface ZephyrRuntimePlugin {
  /**
   * Unique name for the plugin
   */
  name: string;

  /**
   * Called before federation initialization
   */
  beforeInit?(options: InitOptions): InitOptions | Promise<InitOptions>;

  /**
   * Called before resolving a remote container
   */
  beforeRequest?(args: RequestArgs): RequestArgs | Promise<RequestArgs>;

  /**
   * Called after a container is resolved
   */
  afterResolve?(args: ResolveArgs): ResolveArgs | Promise<ResolveArgs>;

  /**
   * Called when a module is loaded
   */
  onLoad?(args: LoadArgs): LoadArgs | Promise<LoadArgs>;

  /**
   * Called when loading a remote container fails
   */
  errorLoadRemote?(args: ErrorArgs): ErrorArgs | Promise<ErrorArgs>;

  /**
   * Called before loading a shared module
   */
  beforeLoadShare?(args: ShareArgs): ShareArgs | Promise<ShareArgs>;

  /**
   * Called when creating a script element for loading
   */
  createScript?(args: ScriptArgs): ScriptArgs | Promise<ScriptArgs>;
}

/**
 * Init Options
 */
export interface InitOptions {
  name: string;
  remotes?: Record<string, string | RemoteConfig>;
  shared?: Record<string, ShareConfig>;
  plugins?: ZephyrRuntimePlugin[];
  [key: string]: any;
}

/**
 * Remote Configuration
 */
export interface RemoteConfig {
  url?: string;
  entry?: string;
  format?: 'esm' | 'systemjs' | 'var';
  from?: 'window' | 'self' | 'parent' | 'top';
}

/**
 * Share Configuration
 */
export interface ShareConfig {
  singleton?: boolean;
  requiredVersion?: string;
  version?: string;
  eager?: boolean;
  strategy?: SharedStrategy;
}

/**
 * Shared Module Strategy
 */
export type SharedStrategy = 'highest-version' | 'lowest-version' | 'loaded-first' | 'host-first';

/**
 * Request Arguments
 */
export interface RequestArgs {
  url: string;
  moduleName: string;
  options?: Record<string, any>;
  retry?: { times: number; delay: number };
}

/**
 * Resolve Arguments
 */
export interface ResolveArgs {
  container: any;
  url: string;
  moduleName: string;
}

/**
 * Load Arguments
 */
export interface LoadArgs {
  module: any;
  moduleName: string;
  container: any;
}

/**
 * Error Arguments
 */
export interface ErrorArgs {
  error: Error;
  url: string;
  moduleName: string;
  retryUrl?: string;
  retryCount?: number;
  module?: any;
}

/**
 * Share Arguments
 */
export interface ShareArgs {
  name: string;
  version: string;
  options: ShareConfig;
}

/**
 * Script Arguments
 */
export interface ScriptArgs {
  url: string;
  scriptElement: HTMLScriptElement;
  attributes?: Record<string, string>;
}

/**
 * Plugin System Implementation
 */
export class PluginSystem {
  private plugins: ZephyrRuntimePlugin[] = [];
  
  /**
   * Register plugins with the system
   */
  registerPlugins(plugins: ZephyrRuntimePlugin[]): void {
    // Validate plugins
    const validatedPlugins = plugins.filter(plugin => {
      if (!plugin || typeof plugin !== 'object') {
        console.warn('Invalid plugin: Plugin must be an object');
        return false;
      }
      
      if (!plugin.name) {
        console.warn('Invalid plugin: Plugin must have a name');
        return false;
      }
      
      // Check if at least one hook is implemented
      const hasHook = [
        'beforeInit',
        'beforeRequest',
        'afterResolve',
        'onLoad',
        'errorLoadRemote',
        'beforeLoadShare',
        'createScript'
      ].some(hook => typeof (plugin as any)[hook] === 'function');
      
      if (!hasHook) {
        console.warn(`Invalid plugin: Plugin "${plugin.name}" doesn't implement any hooks`);
        return false;
      }
      
      return true;
    });
    
    this.plugins.push(...validatedPlugins);
  }
  
  /**
   * Execute a hook across all plugins
   */
  async executeHook<T>(hookName: keyof ZephyrRuntimePlugin, args: T): Promise<T> {
    let result = args;
    
    for (const plugin of this.plugins) {
      const hook = plugin[hookName];
      if (typeof hook === 'function') {
        try {
          result = await Promise.resolve(hook.call(plugin, result));
        } catch (error) {
          console.error(`Error executing ${hookName} hook in plugin "${plugin.name}":`, error);
          // Continue with other plugins
        }
      }
    }
    
    return result;
  }
  
  /**
   * Get all registered plugins
   */
  getPlugins(): ZephyrRuntimePlugin[] {
    return [...this.plugins];
  }
  
  /**
   * Find a plugin by name
   */
  getPluginByName(name: string): ZephyrRuntimePlugin | undefined {
    return this.plugins.find(plugin => plugin.name === name);
  }
  
  /**
   * Clear all plugins
   */
  clearPlugins(): void {
    this.plugins = [];
  }
}

/**
 * Federation Runtime Implementation
 */
export class FederationRuntime {
  private pluginSystem = new PluginSystem();
  private initialized = false;
  private options: InitOptions = { name: '' };
  
  /**
   * Initialize federation with plugins
   */
  async init(options: InitOptions): Promise<void> {
    if (this.initialized) {
      console.warn('Federation runtime already initialized');
      return;
    }
    
    // Register built-in plugins
    if (options.plugins) {
      this.pluginSystem.registerPlugins(options.plugins);
    }
    
    // Execute beforeInit hook
    let modifiedOptions = options;
    try {
      modifiedOptions = await this.pluginSystem.executeHook('beforeInit', options);
    } catch (error) {
      console.error('Error during beforeInit hook execution:', error);
      // Continue with original options
      modifiedOptions = options;
    }
    
    // Store the options for later use
    this.options = modifiedOptions;
    
    // Mark as initialized
    this.initialized = true;
  }
  
  /**
   * Register additional plugins
   */
  registerPlugins(plugins: ZephyrRuntimePlugin[]): void {
    this.pluginSystem.registerPlugins(plugins);
  }
  
  /**
   * Load a remote module
   */
  async loadRemote(moduleName: string, url: string, options?: Record<string, any>): Promise<any> {
    if (!this.initialized) {
      await this.init({ name: 'default' });
    }
    
    let retryCount = 0;
    const maxRetries = 3; // Default max retries
    
    const loadWithRetry = async (): Promise<any> => {
      try {
        // Execute beforeRequest hook
        const requestArgs = await this.pluginSystem.executeHook('beforeRequest', {
          moduleName,
          url,
          options,
          retry: { times: maxRetries - retryCount, delay: 300 * Math.pow(2, retryCount) }
        });
        
        // Resolve container
        const container = await this.resolveContainer(requestArgs.url);
        
        // Execute afterResolve hook
        const resolveArgs = await this.pluginSystem.executeHook('afterResolve', {
          container,
          moduleName: requestArgs.moduleName,
          url: requestArgs.url
        });
        
        // Load module from container
        const module = await this.loadModuleFromContainer(
          resolveArgs.container,
          resolveArgs.moduleName
        );
        
        // Execute onLoad hook
        const loadArgs = await this.pluginSystem.executeHook('onLoad', {
          module,
          moduleName: resolveArgs.moduleName,
          container: resolveArgs.container
        });
        
        return loadArgs.module;
      } catch (error) {
        // Execute errorLoadRemote hook
        const errorArgs = await this.pluginSystem.executeHook('errorLoadRemote', {
          error: error as Error,
          moduleName,
          url,
          retryCount
        });
        
        // Check if a module was provided directly (bypass loading)
        if (errorArgs.module) {
          return errorArgs.module;
        }
        
        // Check if a retry URL was provided
        if (errorArgs.retryUrl) {
          return this.loadRemote(moduleName, errorArgs.retryUrl, options);
        }
        
        // Check if we should retry
        if (retryCount < maxRetries) {
          retryCount++;
          const delay = 300 * Math.pow(2, retryCount - 1);
          
          console.warn(`Retry ${retryCount}/${maxRetries} loading ${moduleName} in ${delay}ms`);
          
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              loadWithRetry().then(resolve).catch(reject);
            }, delay);
          });
        }
        
        // No more retries or fallbacks, rethrow the error
        throw errorArgs.error;
      }
    };
    
    return loadWithRetry();
  }
  
  /**
   * Resolve a container from a URL
   */
  private async resolveContainer(url: string): Promise<any> {
    // In a real implementation, this would load the container from the URL
    // For this example, we'll simulate loading
    
    // Create a script element
    const script = document.createElement('script');
    script.src = url;
    script.type = 'module';
    
    // Execute createScript hook
    const scriptArgs = await this.pluginSystem.executeHook('createScript', {
      url,
      scriptElement: script
    });
    
    // Simulate loading the container
    return new Promise((resolve, reject) => {
      // In a real implementation, this would actually load the script
      // and wait for the container to be available
      setTimeout(() => {
        // Simulate a successful load
        resolve({
          get: (module: string) => Promise.resolve({ default: {} }),
          init: () => {}
        });
      }, 100);
    });
  }
  
  /**
   * Load a module from a container
   */
  private async loadModuleFromContainer(container: any, moduleName: string): Promise<any> {
    // In a real implementation, this would use the container API to load the module
    if (typeof container.get === 'function') {
      // MF 2.0 container
      return container.get(moduleName);
    } else {
      // MF 1.0 or other format, simulate loading
      return { default: {} };
    }
  }
  
  /**
   * Load a shared module
   */
  async loadSharedModule(name: string, version: string, options: ShareConfig): Promise<any> {
    // Execute beforeLoadShare hook
    const shareArgs = await this.pluginSystem.executeHook('beforeLoadShare', {
      name,
      version,
      options
    });
    
    // In a real implementation, this would resolve and load the shared module
    // based on the strategy and options
    
    return { default: {} };
  }
  
  /**
   * Get all registered plugins
   */
  getPlugins(): ZephyrRuntimePlugin[] {
    return this.pluginSystem.getPlugins();
  }
}

/**
 * Global federation runtime instance
 */
let globalRuntime: FederationRuntime | null = null;

/**
 * Get or create the global runtime instance
 */
export function getGlobalRuntime(): FederationRuntime {
  if (!globalRuntime) {
    globalRuntime = new FederationRuntime();
  }
  return globalRuntime;
}

/**
 * Initialize the federation runtime
 */
export async function init(options: InitOptions): Promise<void> {
  const runtime = getGlobalRuntime();
  await runtime.init(options);
}

/**
 * Register plugins with the global runtime
 */
export function registerPlugins(plugins: ZephyrRuntimePlugin[]): void {
  const runtime = getGlobalRuntime();
  runtime.registerPlugins(plugins);
}

/**
 * Load a remote module
 */
export async function loadRemote(moduleName: string, url: string, options?: Record<string, any>): Promise<any> {
  const runtime = getGlobalRuntime();
  return runtime.loadRemote(moduleName, url, options);
}

/**
 * Standard Plugin Implementations
 */

/**
 * Retry Plugin Options
 */
export interface RetryPluginOptions {
  fetch?: {
    retryTimes?: number;
    retryDelay?: number;
    url?: string;
    fallback?: string | (() => string);
  };
  script?: {
    retryTimes?: number;
    retryDelay?: number;
    moduleName?: string[];
  };
}

/**
 * Create a retry plugin
 */
export function createRetryPlugin(options: RetryPluginOptions = {}): ZephyrRuntimePlugin {
  return {
    name: 'zephyr-retry-plugin',
    
    beforeRequest(args) {
      // Only apply to configured module names if specified
      if (options.script?.moduleName && 
          !options.script.moduleName.includes(args.moduleName)) {
        return args;
      }
      
      // Configure retry for this request
      return {
        ...args,
        retry: {
          times: options.script?.retryTimes || 3,
          delay: options.script?.retryDelay || 300
        }
      };
    },
    
    errorLoadRemote(args) {
      // Check if this is a fetch error and we have a fallback URL
      if (options.fetch?.fallback && 
          args.error.message && 
          args.error.message.includes('fetch')) {
        
        console.warn(`Fetch error detected, trying fallback for ${args.moduleName}`);
        
        const fallbackUrl = typeof options.fetch.fallback === 'function'
          ? options.fetch.fallback()
          : options.fetch.fallback;
        
        return {
          ...args,
          retryUrl: fallbackUrl
        };
      }
      
      return args;
    }
  };
}

/**
 * Fallback Plugin Options
 */
export interface FallbackPluginOptions {
  remotes?: Record<string, string | string[]>;
  defaultFallback?: string;
  timeout?: number;
}

/**
 * Create a fallback plugin
 */
export function createFallbackPlugin(options: FallbackPluginOptions = {}): ZephyrRuntimePlugin {
  return {
    name: 'zephyr-fallback-plugin',
    
    errorLoadRemote(args) {
      // Check if we have a fallback for this module
      if (options.remotes && options.remotes[args.moduleName]) {
        const fallback = options.remotes[args.moduleName];
        
        // Handle string or array fallbacks
        const fallbackUrl = Array.isArray(fallback)
          ? fallback[0] // Use first fallback for now
          : fallback;
        
        console.warn(`Using fallback for ${args.moduleName}: ${fallbackUrl}`);
        
        return {
          ...args,
          retryUrl: fallbackUrl
        };
      }
      
      // Check if we have a default fallback
      if (options.defaultFallback) {
        const parsedUrl = new URL(args.url);
        const modulePath = parsedUrl.pathname.split('/').pop() || '';
        
        const fallbackUrl = `${options.defaultFallback}/${modulePath}`;
        
        console.warn(`Using default fallback for ${args.moduleName}: ${fallbackUrl}`);
        
        return {
          ...args,
          retryUrl: fallbackUrl
        };
      }
      
      return args;
    }
  };
}

/**
 * Shared Strategy Plugin Options
 */
export interface SharedStrategyPluginOptions {
  strategy: SharedStrategy;
  moduleSpecificStrategies?: Record<string, SharedStrategy>;
}

/**
 * Create a shared strategy plugin
 */
export function createSharedStrategyPlugin(options: SharedStrategyPluginOptions): ZephyrRuntimePlugin {
  return {
    name: 'zephyr-shared-strategy-plugin',
    
    beforeLoadShare(args) {
      // Check if we have a specific strategy for this module
      if (options.moduleSpecificStrategies && options.moduleSpecificStrategies[args.name]) {
        return {
          ...args,
          options: {
            ...args.options,
            strategy: options.moduleSpecificStrategies[args.name]
          }
        };
      }
      
      // Use default strategy
      return {
        ...args,
        options: {
          ...args.options,
          strategy: options.strategy
        }
      };
    }
  };
}

/**
 * Preload Plugin Options
 */
export interface PreloadPluginOptions {
  preloadAll?: boolean;
  specificModules?: string[];
  preloadStrategy?: 'eager' | 'lazy';
}

/**
 * Create a preload plugin
 */
export function createPreloadPlugin(options: PreloadPluginOptions = {}): ZephyrRuntimePlugin {
  // Track what we've already preloaded
  const preloadedModules = new Set<string>();
  
  return {
    name: 'zephyr-preload-plugin',
    
    beforeInit(args) {
      if (options.preloadAll) {
        // In a real implementation, this would preload all remotes
        console.log('Preloading all remotes');
      }
      
      return args;
    },
    
    afterResolve(args) {
      // If this container has other modules we know about, preload them
      if (options.specificModules && options.specificModules.length > 0) {
        for (const module of options.specificModules) {
          if (!preloadedModules.has(module)) {
            preloadedModules.add(module);
            console.log(`Preloading module: ${module}`);
            // In a real implementation, this would actually preload the module
          }
        }
      }
      
      return args;
    }
  };
}

/**
 * Monitoring Plugin Options
 */
export interface MonitoringPluginOptions {
  enableLogs?: boolean;
  enablePerformanceMarks?: boolean;
  onLoadTime?: (moduleName: string, loadTime: number) => void;
}

/**
 * Create a monitoring plugin
 */
export function createMonitoringPlugin(options: MonitoringPluginOptions = {}): ZephyrRuntimePlugin {
  const loadTimes = new Map<string, number>();
  
  return {
    name: 'zephyr-monitoring-plugin',
    
    beforeRequest(args) {
      loadTimes.set(args.moduleName, Date.now());
      return args;
    },
    
    onLoad(args) {
      const startTime = loadTimes.get(args.moduleName);
      if (startTime) {
        const loadTime = Date.now() - startTime;
        
        if (options.enableLogs) {
          console.log(`Module ${args.moduleName} loaded in ${loadTime}ms`);
        }
        
        if (options.enablePerformanceMarks && typeof window !== 'undefined' && 
            window.performance && window.performance.mark) {
          window.performance.mark(`mf-load-${args.moduleName}`);
          window.performance.measure(
            `mf-load-${args.moduleName}`,
            undefined,
            `mf-load-${args.moduleName}`
          );
        }
        
        if (options.onLoadTime) {
          options.onLoadTime(args.moduleName, loadTime);
        }
      }
      
      return args;
    }
  };
}

/**
 * Create custom error handling plugin
 */
export function createCustomErrorPlugin(
  handler: (args: ErrorArgs) => ErrorArgs | Promise<ErrorArgs>
): ZephyrRuntimePlugin {
  return {
    name: 'zephyr-custom-error-plugin',
    errorLoadRemote: handler
  };
}

/**
 * Export all components
 */
export {
  PluginSystem,
  FederationRuntime
};