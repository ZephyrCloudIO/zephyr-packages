/**
 * Common Plugins Implementation
 * 
 * This module implements common plugin types for the Zephyr runtime plugin system.
 */

import { ZephyrRuntimePlugin, ErrorArgs, RequestArgs, InitOptions, ShareArgs } from './runtime-plugin-system-implementation';

/**
 * Retry Plugin
 * 
 * Handles retry logic for failed remote loading with exponential backoff.
 */
export interface RetryPluginConfig {
  // Maximum number of retry attempts
  maxRetries?: number;
  
  // Initial delay in milliseconds
  initialDelay?: number;
  
  // Maximum delay in milliseconds
  maxDelay?: number;
  
  // Jitter factor to add randomness to delays (0-1)
  jitter?: number;
  
  // Only retry for specific modules
  moduleNames?: string[];
  
  // Only retry for specific error types
  retryableErrors?: (string | RegExp)[];
  
  // Function to determine if an error is retryable
  isRetryable?: (error: Error) => boolean;
  
  // Function to log retry attempts
  onRetry?: (attempt: number, delay: number, error: Error) => void;
}

export function createAdvancedRetryPlugin(config: RetryPluginConfig = {}): ZephyrRuntimePlugin {
  // Set defaults
  const maxRetries = config.maxRetries ?? 3;
  const initialDelay = config.initialDelay ?? 300;
  const maxDelay = config.maxDelay ?? 10000;
  const jitter = config.jitter ?? 0.1;
  
  // Track retry counts per module
  const retryCounters = new Map<string, number>();
  
  // Check if an error is retryable
  const isRetryable = (error: Error): boolean => {
    if (config.isRetryable) {
      return config.isRetryable(error);
    }
    
    if (!config.retryableErrors || config.retryableErrors.length === 0) {
      // Default: retry all errors
      return true;
    }
    
    const errorMsg = error.message || '';
    return config.retryableErrors.some(pattern => {
      if (typeof pattern === 'string') {
        return errorMsg.includes(pattern);
      }
      return pattern.test(errorMsg);
    });
  };
  
  // Calculate delay with exponential backoff and jitter
  const calculateDelay = (attempt: number): number => {
    const expDelay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
    
    if (jitter <= 0) {
      return expDelay;
    }
    
    // Add jitter to prevent thundering herd problem
    const jitterAmount = expDelay * jitter;
    return expDelay - jitterAmount + (Math.random() * jitterAmount * 2);
  };
  
  return {
    name: 'zephyr-advanced-retry-plugin',
    
    beforeRequest(args: RequestArgs): RequestArgs {
      const moduleName = args.moduleName;
      
      // Skip if we're only handling specific modules and this isn't one of them
      if (config.moduleNames && !config.moduleNames.includes(moduleName)) {
        return args;
      }
      
      // Reset retry counter for new requests
      retryCounters.set(moduleName, 0);
      
      return args;
    },
    
    errorLoadRemote(args: ErrorArgs): ErrorArgs {
      const { error, moduleName } = args;
      
      // Skip if we're only handling specific modules and this isn't one of them
      if (config.moduleNames && !config.moduleNames.includes(moduleName)) {
        return args;
      }
      
      // Check if this error is retryable
      if (!isRetryable(error)) {
        return args;
      }
      
      // Get current retry count
      let retryCount = retryCounters.get(moduleName) || 0;
      
      // Check if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        retryCount++;
        retryCounters.set(moduleName, retryCount);
        
        // Calculate delay for this retry
        const delay = calculateDelay(retryCount - 1);
        
        // Log retry attempt if callback provided
        if (config.onRetry) {
          config.onRetry(retryCount, delay, error);
        } else {
          console.warn(`Retry ${retryCount}/${maxRetries} for ${moduleName} in ${delay}ms`, error);
        }
        
        // Signal that we want to retry with a delay
        return {
          ...args,
          retryCount,
          // NOTE: In a real implementation, we might use a different mechanism
          // to signal retry with delay, as retryUrl typically expects a different URL
          retryDelay: delay
        };
      }
      
      // Max retries exceeded
      console.error(`Max retries (${maxRetries}) exceeded for ${moduleName}`, error);
      return args;
    }
  };
}

/**
 * Circuit Breaker Plugin
 * 
 * Implements the circuit breaker pattern to prevent cascading failures.
 */
export interface CircuitBreakerConfig {
  // Threshold of failures before opening the circuit
  failureThreshold?: number;
  
  // Time in milliseconds to keep the circuit open
  resetTimeout?: number;
  
  // Time window in milliseconds to track failures
  failureWindow?: number;
  
  // Function to execute when circuit opens
  onOpen?: (moduleName: string) => void;
  
  // Function to execute when circuit closes
  onClose?: (moduleName: string) => void;
  
  // Function to execute when circuit is half-open
  onHalfOpen?: (moduleName: string) => void;
}

export enum CircuitState {
  CLOSED,      // Normal operation
  OPEN,        // Not allowing requests
  HALF_OPEN    // Testing if system has recovered
}

export function createCircuitBreakerPlugin(config: CircuitBreakerConfig = {}): ZephyrRuntimePlugin {
  // Set defaults
  const failureThreshold = config.failureThreshold ?? 5;
  const resetTimeout = config.resetTimeout ?? 30000;
  const failureWindow = config.failureWindow ?? 60000;
  
  // Circuit state per module
  const circuitStates = new Map<string, CircuitState>();
  
  // Failure counts per module
  const failures = new Map<string, {count: number, timestamp: number}[]>();
  
  // Circuit open timestamps
  const openTimestamps = new Map<string, number>();
  
  // Check circuit state
  const getCircuitState = (moduleName: string): CircuitState => {
    // Default to closed
    if (!circuitStates.has(moduleName)) {
      circuitStates.set(moduleName, CircuitState.CLOSED);
    }
    
    return circuitStates.get(moduleName)!;
  };
  
  // Set circuit state
  const setCircuitState = (moduleName: string, state: CircuitState): void => {
    const currentState = getCircuitState(moduleName);
    
    if (currentState !== state) {
      circuitStates.set(moduleName, state);
      
      // Fire callbacks
      if (state === CircuitState.OPEN && config.onOpen) {
        config.onOpen(moduleName);
      } else if (state === CircuitState.CLOSED && config.onClose) {
        config.onClose(moduleName);
      } else if (state === CircuitState.HALF_OPEN && config.onHalfOpen) {
        config.onHalfOpen(moduleName);
      }
      
      // Record timestamp when circuit opens
      if (state === CircuitState.OPEN) {
        openTimestamps.set(moduleName, Date.now());
      }
    }
  };
  
  // Record a failure
  const recordFailure = (moduleName: string): void => {
    const now = Date.now();
    const moduleFailures = failures.get(moduleName) || [];
    
    // Add new failure
    moduleFailures.push({ count: 1, timestamp: now });
    
    // Remove old failures outside the window
    const windowStart = now - failureWindow;
    const recentFailures = moduleFailures.filter(f => f.timestamp >= windowStart);
    
    failures.set(moduleName, recentFailures);
    
    // Count recent failures
    const failureCount = recentFailures.reduce((sum, f) => sum + f.count, 0);
    
    // Check if we should open the circuit
    if (failureCount >= failureThreshold) {
      setCircuitState(moduleName, CircuitState.OPEN);
    }
  };
  
  // Check if the circuit should transition from OPEN to HALF_OPEN
  const checkReset = (moduleName: string): void => {
    const state = getCircuitState(moduleName);
    
    if (state === CircuitState.OPEN) {
      const openTime = openTimestamps.get(moduleName) || 0;
      const now = Date.now();
      
      if (now - openTime >= resetTimeout) {
        setCircuitState(moduleName, CircuitState.HALF_OPEN);
      }
    }
  };
  
  return {
    name: 'zephyr-circuit-breaker-plugin',
    
    beforeRequest(args: RequestArgs): RequestArgs {
      const moduleName = args.moduleName;
      
      // Check if we should try to reset the circuit
      checkReset(moduleName);
      
      // Check current circuit state
      const state = getCircuitState(moduleName);
      
      if (state === CircuitState.OPEN) {
        // Fail fast with circuit open
        throw new Error(`Circuit is OPEN for ${moduleName}`);
      }
      
      return args;
    },
    
    errorLoadRemote(args: ErrorArgs): ErrorArgs {
      const { moduleName } = args;
      const state = getCircuitState(moduleName);
      
      if (state === CircuitState.HALF_OPEN) {
        // If failure in HALF_OPEN, go back to OPEN
        setCircuitState(moduleName, CircuitState.OPEN);
      } else if (state === CircuitState.CLOSED) {
        // Record failure in CLOSED state
        recordFailure(moduleName);
      }
      
      return args;
    },
    
    onLoad(args): any {
      const { moduleName } = args;
      const state = getCircuitState(moduleName);
      
      if (state === CircuitState.HALF_OPEN) {
        // Success in HALF_OPEN, restore to CLOSED
        setCircuitState(moduleName, CircuitState.CLOSED);
        
        // Clear failure history
        failures.set(moduleName, []);
      }
      
      return args;
    }
  };
}

/**
 * Cache Plugin
 * 
 * Caches module loading results to improve performance.
 */
export interface CachePluginConfig {
  // Cache duration in milliseconds (default: 1 hour)
  cacheDuration?: number;
  
  // Whether to use localStorage for persistent caching
  persistent?: boolean;
  
  // Custom storage mechanism
  storage?: {
    getItem: (key: string) => string | null | Promise<string | null>;
    setItem: (key: string, value: string) => void | Promise<void>;
    removeItem: (key: string) => void | Promise<void>;
  };
  
  // Modules to exclude from caching
  excludeModules?: string[];
  
  // Function to determine if a module should be cached
  shouldCache?: (moduleName: string) => boolean;
}

export function createCachePlugin(config: CachePluginConfig = {}): ZephyrRuntimePlugin {
  // Set defaults
  const cacheDuration = config.cacheDuration ?? 3600000; // 1 hour
  const persistent = config.persistent ?? false;
  
  // In-memory cache
  const memoryCache = new Map<string, {
    data: any;
    timestamp: number;
  }>();
  
  // Storage implementation
  const storage = config.storage || {
    getItem: (key: string) => {
      if (persistent && typeof localStorage !== 'undefined') {
        return localStorage.getItem(`zephyr_cache_${key}`);
      }
      return null;
    },
    setItem: (key: string, value: string) => {
      if (persistent && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(`zephyr_cache_${key}`, value);
        } catch (e) {
          console.warn('Failed to write to localStorage:', e);
        }
      }
    },
    removeItem: (key: string) => {
      if (persistent && typeof localStorage !== 'undefined') {
        localStorage.removeItem(`zephyr_cache_${key}`);
      }
    }
  };
  
  // Check if a module should be cached
  const shouldCache = (moduleName: string): boolean => {
    if (config.shouldCache) {
      return config.shouldCache(moduleName);
    }
    
    if (config.excludeModules && config.excludeModules.includes(moduleName)) {
      return false;
    }
    
    return true;
  };
  
  // Cache key generator
  const getCacheKey = (moduleName: string, url: string): string => {
    return `${moduleName}:${url}`;
  };
  
  // Check if cache is valid
  const isCacheValid = (timestamp: number): boolean => {
    return Date.now() - timestamp < cacheDuration;
  };
  
  return {
    name: 'zephyr-cache-plugin',
    
    async beforeRequest(args: RequestArgs): Promise<RequestArgs> {
      const { moduleName, url } = args;
      
      if (!shouldCache(moduleName)) {
        return args;
      }
      
      const cacheKey = getCacheKey(moduleName, url);
      
      // Check memory cache first
      const memCached = memoryCache.get(cacheKey);
      if (memCached && isCacheValid(memCached.timestamp)) {
        // Use cached version and bypass normal loading
        throw new Error('__CACHED_MODULE__');
      }
      
      // Check persistent cache if enabled
      if (persistent) {
        try {
          const cached = await storage.getItem(cacheKey);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            
            if (isCacheValid(timestamp)) {
              // Update memory cache
              memoryCache.set(cacheKey, { data, timestamp });
              
              // Use cached version and bypass normal loading
              throw new Error('__CACHED_MODULE__');
            } else {
              // Cache expired, remove it
              await storage.removeItem(cacheKey);
            }
          }
        } catch (e) {
          console.warn('Cache retrieval error:', e);
        }
      }
      
      return args;
    },
    
    async errorLoadRemote(args: ErrorArgs): Promise<ErrorArgs> {
      // Special error for cached modules
      if (args.error.message === '__CACHED_MODULE__') {
        const cacheKey = getCacheKey(args.moduleName, args.url);
        const cached = memoryCache.get(cacheKey);
        
        if (cached) {
          console.log(`Using cached module: ${args.moduleName}`);
          return {
            ...args,
            module: cached.data
          };
        }
      }
      
      return args;
    },
    
    async onLoad(args): Promise<any> {
      const { moduleName, module, container } = args;
      
      // Get URL from container if possible
      let url = '';
      if (container && container._url) {
        url = container._url;
      }
      
      if (shouldCache(moduleName) && url) {
        const cacheKey = getCacheKey(moduleName, url);
        const timestamp = Date.now();
        
        // Update memory cache
        memoryCache.set(cacheKey, {
          data: module,
          timestamp
        });
        
        // Update persistent cache if enabled
        if (persistent) {
          try {
            await storage.setItem(cacheKey, JSON.stringify({
              data: module,
              timestamp
            }));
          } catch (e) {
            console.warn('Cache storage error:', e);
          }
        }
      }
      
      return args;
    }
  };
}

/**
 * Versioning Plugin
 * 
 * Manages version selection and conflicts for shared modules.
 */
export interface VersioningPluginConfig {
  // Version overrides for specific modules
  versionOverrides?: Record<string, string>;
  
  // Version resolution strategy
  strategy?: 'highest' | 'lowest' | 'exact';
  
  // Function to determine if versions are compatible
  areVersionsCompatible?: (requested: string, available: string) => boolean;
  
  // Function to handle version conflicts
  onVersionConflict?: (moduleName: string, requested: string, available: string) => void;
}

export function createVersioningPlugin(config: VersioningPluginConfig = {}): ZephyrRuntimePlugin {
  // Set defaults
  const strategy = config.strategy || 'highest';
  
  // Version parsing helper
  const parseVersion = (version: string): number[] => {
    // Handle semver syntax
    const semverMatch = version.match(/^[~^]?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/);
    if (semverMatch) {
      return [
        parseInt(semverMatch[1], 10),
        parseInt(semverMatch[2], 10),
        parseInt(semverMatch[3], 10)
      ];
    }
    
    // Handle basic version numbers
    const parts = version.split('.');
    return parts.map(p => parseInt(p, 10) || 0);
  };
  
  // Version comparison
  const compareVersions = (a: string, b: string): number => {
    const partsA = parseVersion(a);
    const partsB = parseVersion(b);
    
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;
      
      if (partA !== partB) {
        return partA - partB;
      }
    }
    
    return 0;
  };
  
  // Version compatibility check
  const areVersionsCompatible = (requested: string, available: string): boolean => {
    if (config.areVersionsCompatible) {
      return config.areVersionsCompatible(requested, available);
    }
    
    // Handle semver ranges
    if (requested.startsWith('^')) {
      const reqVersion = requested.substring(1);
      const reqParts = parseVersion(reqVersion);
      const availParts = parseVersion(available);
      
      // Major version must match, minor and patch can be higher
      return availParts[0] === reqParts[0] && compareVersions(available, reqVersion) >= 0;
    }
    
    if (requested.startsWith('~')) {
      const reqVersion = requested.substring(1);
      const reqParts = parseVersion(reqVersion);
      const availParts = parseVersion(available);
      
      // Major and minor must match, patch can be higher
      return availParts[0] === reqParts[0] && 
             availParts[1] === reqParts[1] && 
             compareVersions(available, reqVersion) >= 0;
    }
    
    // Exact match for everything else
    return compareVersions(requested, available) === 0;
  };
  
  // Version selection based on strategy
  const selectVersion = (available: string[], requested: string): string => {
    if (available.length === 0) {
      return requested;
    }
    
    if (available.length === 1) {
      return available[0];
    }
    
    if (strategy === 'highest') {
      return available.sort((a, b) => compareVersions(b, a))[0];
    }
    
    if (strategy === 'lowest') {
      return available.sort((a, b) => compareVersions(a, b))[0];
    }
    
    // 'exact' strategy - find the closest match
    const compatible = available.filter(v => areVersionsCompatible(requested, v));
    if (compatible.length > 0) {
      return compatible.sort((a, b) => compareVersions(b, a))[0];
    }
    
    // No compatible version, use highest
    return available.sort((a, b) => compareVersions(b, a))[0];
  };
  
  return {
    name: 'zephyr-versioning-plugin',
    
    beforeInit(options: InitOptions): InitOptions {
      // Apply version overrides to shared modules
      if (config.versionOverrides && options.shared) {
        const overriddenShared = { ...options.shared };
        
        for (const [moduleName, version] of Object.entries(config.versionOverrides)) {
          if (overriddenShared[moduleName]) {
            overriddenShared[moduleName] = {
              ...overriddenShared[moduleName],
              requiredVersion: version
            };
          }
        }
        
        return {
          ...options,
          shared: overriddenShared
        };
      }
      
      return options;
    },
    
    beforeLoadShare(args: ShareArgs): ShareArgs {
      const { name, version, options } = args;
      
      // Check for version override
      if (config.versionOverrides && config.versionOverrides[name]) {
        const overrideVersion = config.versionOverrides[name];
        
        if (!areVersionsCompatible(overrideVersion, version)) {
          if (config.onVersionConflict) {
            config.onVersionConflict(name, overrideVersion, version);
          } else {
            console.warn(`Version conflict for ${name}: requested ${overrideVersion}, available ${version}`);
          }
        }
        
        return {
          ...args,
          version: overrideVersion,
          options: {
            ...options,
            requiredVersion: overrideVersion
          }
        };
      }
      
      return args;
    }
  };
}

/**
 * Telemetry Plugin
 * 
 * Collects performance and usage data for federated modules.
 */
export interface TelemetryPluginConfig {
  // URL to send telemetry data to
  endpoint?: string;
  
  // Additional data to include with telemetry
  additionalData?: Record<string, any>;
  
  // Whether to automatically send telemetry
  autoSend?: boolean;
  
  // How often to send batched telemetry (milliseconds)
  sendInterval?: number;
  
  // Types of events to collect
  collect?: {
    loadTimes?: boolean;
    errors?: boolean;
    usage?: boolean;
    performance?: boolean;
  };
}

export function createTelemetryPlugin(config: TelemetryPluginConfig = {}): ZephyrRuntimePlugin {
  // Set defaults
  const endpoint = config.endpoint || '';
  const autoSend = config.autoSend ?? true;
  const sendInterval = config.sendInterval ?? 60000; // 1 minute
  const collect = config.collect || {
    loadTimes: true,
    errors: true,
    usage: true,
    performance: true
  };
  
  // Telemetry data store
  const telemetryData: any[] = [];
  
  // Module load start times
  const loadStartTimes = new Map<string, number>();
  
  // Set up periodic sending if auto-send is enabled
  let sendIntervalId: NodeJS.Timeout | null = null;
  
  if (autoSend && endpoint && typeof window !== 'undefined') {
    sendIntervalId = setInterval(() => {
      sendTelemetry();
    }, sendInterval);
  }
  
  // Send telemetry data
  const sendTelemetry = async (): Promise<void> => {
    if (!endpoint || telemetryData.length === 0) {
      return;
    }
    
    // Clone the data and clear the buffer
    const dataToSend = [...telemetryData];
    telemetryData.length = 0;
    
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timestamp: Date.now(),
          data: dataToSend,
          ...config.additionalData
        })
      });
    } catch (e) {
      console.error('Failed to send telemetry:', e);
      // Put the data back in the buffer
      telemetryData.push(...dataToSend);
    }
  };
  
  // Record a telemetry event
  const recordEvent = (type: string, data: any): void => {
    telemetryData.push({
      type,
      timestamp: Date.now(),
      ...data
    });
  };
  
  // Clean up when the window unloads
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (sendIntervalId) {
        clearInterval(sendIntervalId);
      }
      
      // Send any remaining telemetry
      if (autoSend && telemetryData.length > 0) {
        // Use sendBeacon for more reliable delivery during page unload
        if (navigator.sendBeacon && endpoint) {
          navigator.sendBeacon(endpoint, JSON.stringify({
            timestamp: Date.now(),
            data: telemetryData,
            ...config.additionalData
          }));
        }
      }
    });
  }
  
  return {
    name: 'zephyr-telemetry-plugin',
    
    beforeInit(options: InitOptions): InitOptions {
      if (collect.usage) {
        recordEvent('federation_init', {
          name: options.name,
          remoteCount: options.remotes ? Object.keys(options.remotes).length : 0,
          sharedCount: options.shared ? Object.keys(options.shared).length : 0
        });
      }
      
      return options;
    },
    
    beforeRequest(args: RequestArgs): RequestArgs {
      const { moduleName, url } = args;
      
      if (collect.loadTimes) {
        loadStartTimes.set(moduleName, performance.now());
      }
      
      if (collect.usage) {
        recordEvent('module_request', {
          moduleName,
          url
        });
      }
      
      return args;
    },
    
    onLoad(args): any {
      const { moduleName } = args;
      
      if (collect.loadTimes) {
        const startTime = loadStartTimes.get(moduleName);
        if (startTime) {
          const loadTime = performance.now() - startTime;
          
          recordEvent('module_load', {
            moduleName,
            loadTime
          });
          
          loadStartTimes.delete(moduleName);
        }
      }
      
      if (collect.performance && typeof window !== 'undefined' && 
          window.performance && window.performance.getEntriesByType) {
        // Collect performance data
        const resources = window.performance.getEntriesByType('resource')
          .filter(entry => entry.name.includes(moduleName))
          .map(entry => ({
            name: entry.name,
            duration: entry.duration,
            size: (entry as any).transferSize || 0
          }));
        
        if (resources.length > 0) {
          recordEvent('resource_performance', {
            moduleName,
            resources
          });
        }
      }
      
      return args;
    },
    
    errorLoadRemote(args: ErrorArgs): ErrorArgs {
      const { moduleName, error } = args;
      
      if (collect.errors) {
        recordEvent('module_error', {
          moduleName,
          error: {
            message: error.message,
            stack: error.stack
          }
        });
      }
      
      return args;
    }
  };
}

/**
 * Export the plugin collection
 */
export const ZephyrPlugins = {
  retry: createAdvancedRetryPlugin,
  circuitBreaker: createCircuitBreakerPlugin,
  cache: createCachePlugin,
  versioning: createVersioningPlugin,
  telemetry: createTelemetryPlugin
};