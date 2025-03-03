/**
 * Enhanced Runtime Code Generation
 * 
 * This module provides enhanced runtime code generation for both
 * Module Federation 1.0 and 2.0, with support for semver, fallbacks, and SSR.
 */

import { MFVersion } from './enhanced-plugin-detection';

/**
 * Interface for resolved dependency
 */
interface ZeResolvedDependency {
  name: string;
  application_uid: string;
  remote_entry_url: string;
  default_url: string;
  library_type: string;
  mfVersion?: MFVersion;
  version?: string;                     // Semver version
  fallbacks?: string[];                 // Array of fallback URLs
  ssrEnabled?: boolean;                 // Whether SSR is enabled
}

/**
 * Options for runtime code generation
 */
interface RuntimeCodeOptions {
  includeSemver?: boolean;              // Whether to include semver support
  includeFallbacks?: boolean;           // Whether to include fallback mechanisms
  includeSSR?: boolean;                 // Whether to include SSR support
  semverRegistryUrl?: string;           // URL for semver registry
  maxRetries?: number;                  // Maximum retry attempts
  initialRetryDelay?: number;           // Initial delay for retry in milliseconds
  circuitBreakerEnabled?: boolean;      // Whether to enable circuit breaker
  plugins?: Array<string | RuntimePlugin>;  // Runtime plugins to include
}

/**
 * Create MF runtime code based on the MF version
 */
function createMfRuntimeCode(
  deps: ZeResolvedDependency,
  mfVersion: MFVersion = MFVersion.MF1,
  options: RuntimeCodeOptions = {}
): string {
  // Set default options
  const opts: RuntimeCodeOptions = {
    includeSemver: true,
    includeFallbacks: true,
    includeSSR: false,
    semverRegistryUrl: 'https://api.zephyr.dev/versions',
    maxRetries: 3,
    initialRetryDelay: 300,
    circuitBreakerEnabled: true,
    plugins: [],
    ...options
  };

  return mfVersion === MFVersion.MF2
    ? createMF2RuntimeCode(deps, opts)
    : createMF1RuntimeCode(deps, opts);
}

/**
 * Create runtime code for MF 1.0
 */
function createMF1RuntimeCode(deps: ZeResolvedDependency, options: RuntimeCodeOptions): string {
  // prepare delegate function string template
  let fnReplace = xpack_delegate_module_template.toString();
  const strStart = new RegExp(/^function[\W\S]+return new Promise/);
  const strNewStart = `promise new Promise`;
  const strEnd = new RegExp(/;[^)}]+}$/);
  
  // Add semver utilities if needed
  if (options.includeSemver) {
    fnReplace = injectSemverSupport(fnReplace, deps.version);
  }
  
  // Add fallback utilities if needed
  if (options.includeFallbacks && deps.fallbacks && deps.fallbacks.length > 0) {
    fnReplace = injectFallbackSupport(fnReplace, deps.fallbacks, options.maxRetries, options.initialRetryDelay);
  }
  
  // Add SSR utilities if needed
  if (options.includeSSR && deps.ssrEnabled) {
    fnReplace = injectSSRSupport(fnReplace, MFVersion.MF1);
  }
  
  const promiseNewPromise = fnReplace.replace(strStart, strNewStart).replace(strEnd, '');

  const { application_uid, remote_entry_url, default_url, name, library_type } = deps;

  // Replace placeholders in the template
  let code = promiseNewPromise
    .replace('__APPLICATION_UID__', application_uid)
    .replace('__REMOTE_ENTRY_URL__', remote_entry_url)
    .replace('__REMOTE_NAME__', name)
    .replace('__DEFAULT_URL__', default_url)
    .replace('__LIBRARY_TYPE__', library_type);
  
  // Add runtime plugins initialization if any
  if (options.plugins && options.plugins.length > 0) {
    code += '\n' + createRuntimePluginsInitCode(options.plugins);
  }
  
  return code;
}

/**
 * Create runtime code for MF 2.0
 */
function createMF2RuntimeCode(deps: ZeResolvedDependency, options: RuntimeCodeOptions): string {
  // prepare delegate function string template
  let fnReplace = mf2_delegate_module_template.toString();
  const strStart = new RegExp(/^function[\W\S]+return new Promise/);
  const strNewStart = `promise new Promise`;
  const strEnd = new RegExp(/;[^)}]+}$/);
  
  // Add semver utilities if needed
  if (options.includeSemver) {
    fnReplace = injectSemverSupport(fnReplace, deps.version);
  }
  
  // Add fallback utilities if needed
  if (options.includeFallbacks && deps.fallbacks && deps.fallbacks.length > 0) {
    fnReplace = injectFallbackSupport(fnReplace, deps.fallbacks, options.maxRetries, options.initialRetryDelay);
  }
  
  // Add SSR utilities if needed
  if (options.includeSSR && deps.ssrEnabled) {
    fnReplace = injectSSRSupport(fnReplace, MFVersion.MF2);
  }
  
  // Add circuit breaker if enabled
  if (options.circuitBreakerEnabled) {
    fnReplace = injectCircuitBreaker(fnReplace);
  }
  
  const promiseNewPromise = fnReplace.replace(strStart, strNewStart).replace(strEnd, '');

  const { application_uid, remote_entry_url, default_url, name, library_type } = deps;

  // Replace placeholders in the template
  let code = promiseNewPromise
    .replace('__APPLICATION_UID__', application_uid)
    .replace('__REMOTE_ENTRY_URL__', remote_entry_url)
    .replace('__REMOTE_NAME__', name)
    .replace('__DEFAULT_URL__', default_url)
    .replace('__LIBRARY_TYPE__', library_type);
  
  // Add runtime plugins initialization if any
  if (options.plugins && options.plugins.length > 0) {
    code += '\n' + createRuntimePluginsInitCode(options.plugins);
  }
  
  return code;
}

/**
 * Injects semver support into the template
 */
function injectSemverSupport(template: string, version?: string): string {
  if (!version) return template;
  
  // Add semver utilities at the beginning of the function
  const semverUtilities = `
    // Semver utilities
    const semver = {
      // Parse version into components
      parse: function(version) {
        const match = version.match(/^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$/);
        if (!match) return null;
        
        return {
          major: parseInt(match[1], 10),
          minor: parseInt(match[2], 10),
          patch: parseInt(match[3], 10),
          prerelease: match[4],
          buildMetadata: match[5]
        };
      },
      
      // Compare two versions
      compare: function(v1, v2) {
        const version1 = this.parse(v1);
        const version2 = this.parse(v2);
        
        if (!version1 || !version2) throw new Error('Invalid version format');
        
        // Compare major.minor.patch
        const majorDiff = version1.major - version2.major;
        if (majorDiff !== 0) return majorDiff;
        
        const minorDiff = version1.minor - version2.minor;
        if (minorDiff !== 0) return minorDiff;
        
        const patchDiff = version1.patch - version2.patch;
        if (patchDiff !== 0) return patchDiff;
        
        // If we get here, we need to compare prerelease versions
        if (!version1.prerelease && !version2.prerelease) return 0;
        if (!version1.prerelease) return 1;
        if (!version2.prerelease) return -1;
        
        const prerelease1 = version1.prerelease.split('.');
        const prerelease2 = version2.prerelease.split('.');
        
        const minLength = Math.min(prerelease1.length, prerelease2.length);
        
        for (let i = 0; i < minLength; i++) {
          const isNum1 = /^\\d+$/.test(prerelease1[i]);
          const isNum2 = /^\\d+$/.test(prerelease2[i]);
          
          if (isNum1 && !isNum2) return -1;
          if (!isNum1 && isNum2) return 1;
          
          if (isNum1 && isNum2) {
            const diff = parseInt(prerelease1[i], 10) - parseInt(prerelease2[i], 10);
            if (diff !== 0) return diff;
          } else {
            const diff = prerelease1[i].localeCompare(prerelease2[i]);
            if (diff !== 0) return diff;
          }
        }
        
        return prerelease1.length - prerelease2.length;
      }
    };
    
    // Check for version requirements
    const requiredVersion = "${version}";
    const versionMatch = remote_entry_url.match(/\\/v(\\d+\\.\\d+\\.\\d+(?:-[\\w.-]+)?(?:\\+[\\w.-]+)?)\\//) || [];
    const remoteVersion = versionMatch[1];
    
    if (remoteVersion && requiredVersion) {
      console.log(\`Zephyr: Remote version \${remoteVersion}, required \${requiredVersion}\`);
      
      // Log version information
      try {
        if (requiredVersion.startsWith('^') && remoteVersion) {
          const req = requiredVersion.substring(1);
          const reqVer = semver.parse(req);
          const remVer = semver.parse(remoteVersion);
          
          if (reqVer && remVer) {
            if (reqVer.major !== remVer.major || 
                (reqVer.major === 0 && reqVer.minor !== remVer.minor)) {
              console.warn(\`Zephyr: Version mismatch! Required: \${requiredVersion}, Found: \${remoteVersion}\`);
            }
          }
        } else if (requiredVersion.startsWith('~') && remoteVersion) {
          const req = requiredVersion.substring(1);
          const reqVer = semver.parse(req);
          const remVer = semver.parse(remoteVersion);
          
          if (reqVer && remVer) {
            if (reqVer.major !== remVer.major || reqVer.minor !== remVer.minor) {
              console.warn(\`Zephyr: Version mismatch! Required: \${requiredVersion}, Found: \${remoteVersion}\`);
            }
          }
        }
      } catch (e) {
        console.error('Zephyr: Error checking version compatibility', e);
      }
    }
  `;
  
  // Insert semver utilities after the Promise constructor
  return template.replace(
    'return new Promise((resolve, reject) => {',
    'return new Promise((resolve, reject) => {' + semverUtilities
  );
}

/**
 * Injects fallback support into the template
 */
function injectFallbackSupport(
  template: string, 
  fallbacks: string[], 
  maxRetries = 3, 
  initialDelay = 300
): string {
  if (fallbacks.length === 0) return template;
  
  // Add fallback URLs to the template
  const fallbackSetup = `
    // Fallback URLs in priority order
    const fallbackUrls = ${JSON.stringify(fallbacks)};
    let currentFallbackIndex = -1; // Start with the primary URL
    
    // Function to get next fallback URL
    function getNextFallbackUrl() {
      currentFallbackIndex++;
      if (currentFallbackIndex === 0) {
        return edgeUrl; // First try the primary URL
      } else if (currentFallbackIndex <= fallbackUrls.length) {
        const fallbackUrl = fallbackUrls[currentFallbackIndex - 1];
        console.log(\`Zephyr: Trying fallback #\${currentFallbackIndex}: \${fallbackUrl}\`);
        return fallbackUrl;
      }
      return null; // No more fallbacks
    }
    
    // Update max retries to account for fallbacks
    const MAX_RETRIES = ${maxRetries} + fallbackUrls.length;
    const INITIAL_DELAY = ${initialDelay};
  `;
  
  // Find appropriate place to insert fallback logic
  if (template.includes('function attemptLoadWithRetry()')) {
    // For MF 2.0 template, update the retry logic
    return template
      .replace(
        'function attemptLoadWithRetry() {',
        fallbackSetup + '\n    function attemptLoadWithRetry() {'
      )
      .replace(
        'fetch(edgeUrl, { method: \'HEAD\' })',
        'const nextUrl = getNextFallbackUrl();\n' +
        '      if (!nextUrl) {\n' +
        '        console.error(`Zephyr: All fallbacks exhausted for ${remote_name}`);\n' +
        '        return;\n' +
        '      }\n' +
        '      fetch(nextUrl, { method: \'HEAD\' })'
      )
      .replace(
        'loadRemote(edgeUrl);',
        'loadRemote(nextUrl);'
      );
  } else {
    // For MF 1.0 template, add complete retry logic
    const retryLogic = `
    // Max retries including fallbacks
    const MAX_RETRIES = ${maxRetries} + fallbackUrls.length;
    const INITIAL_DELAY = ${initialDelay};
    let retryCount = 0;
    
    function attemptLoadWithRetry() {
      const nextUrl = getNextFallbackUrl();
      if (!nextUrl) {
        console.error(\`Zephyr: All fallbacks exhausted for \${remote_name}\`);
        reject(new Error(\`Failed to load remote \${remote_name} after exhausting all fallbacks\`));
        return;
      }
      
      fetch(nextUrl, { method: 'HEAD' })
        .then(() => {
          // Construct script URL and load it
          const scriptUrl = nextUrl;
          
          // For webpack/rspack with non-module library type
          if (
            typeof __webpack_require__ !== 'undefined' &&
            typeof __webpack_require__.l === 'function' &&
            library_type !== 'module'
          ) {
            __webpack_require__.l(
              scriptUrl,
              () => {
                resolve(_win[remote_name]);
              },
              remote_name,
              remote_name
            );
            return;
          }
          
          // For ESM
          new Function(\`return import("\${scriptUrl}")\`)()
            .then((mod) => {
              if (typeof _win[remote_name] !== 'undefined') {
                return resolve(_win[remote_name]);
              }
              return resolve(mod);
            })
            .catch((err) => {
              console.error(\`Zephyr: error importing module: \${scriptUrl}\`, err);
              
              // Try next fallback
              if (retryCount < MAX_RETRIES) {
                retryCount++;
                const delay = INITIAL_DELAY * Math.pow(2, retryCount - 1);
                setTimeout(attemptLoadWithRetry, delay);
              } else {
                reject(err);
              }
            });
        })
        .catch((error) => {
          console.warn(\`Zephyr: error checking remote \${nextUrl}, attempt \${retryCount + 1}/\${MAX_RETRIES}\`, error);
          
          // Retry with next fallback
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = INITIAL_DELAY * Math.pow(2, retryCount - 1);
            setTimeout(attemptLoadWithRetry, delay);
          } else {
            console.error(\`Zephyr: failed to load remote after \${MAX_RETRIES} retries: \${remote_entry_url}\`);
            reject(error);
          }
        });
    }
    
    // Start the loading process
    attemptLoadWithRetry();
    `;
    
    // Remove existing Promise.race code and replace with retry logic
    return template
      .replace(
        'const resolve_entry = [',
        fallbackSetup + '\n    // Replaced with retry logic'
      )
      .replace(
        /const resolve_entry = \[[\s\S]+?Promise\.race[\s\S]+?\.catch[\s\S]+?\}\);/m,
        retryLogic
      );
  }
}

/**
 * Injects SSR support into the template
 */
function injectSSRSupport(template: string, mfVersion: MFVersion): string {
  const ssrCode = `
    // SSR utilities for Module Federation ${mfVersion}
    const isSSR = typeof window === 'undefined';
    
    // Create/access global store for SSR state
    const __ZEPHYR_SSR_STORE = !isSSR && window.__ZEPHYR_SSR_STORE || {};
    
    // Only run this code in a browser environment
    if (!isSSR) {
      // Store preloaded modules from SSR
      window.__ZEPHYR_SSR_STORE = window.__ZEPHYR_SSR_STORE || {};
      
      // Check for preloaded modules
      const preloadedModule = window.__ZEPHYR_SSR_STORE[remote_name];
      if (preloadedModule) {
        console.log(\`Zephyr MF ${mfVersion}: Found preloaded module for \${remote_name}\`);
      }
      
      // Hydration handler
      function hydrateRemoteModule(module, props) {
        const preloadedState = window.__ZEPHYR_SSR_STORE[remote_name];
        
        if (preloadedState) {
          console.log(\`Zephyr MF ${mfVersion}: Hydrating remote module \${remote_name}\`);
          
          // Apply preloaded state if the module exports a hydrate method
          if (typeof module.hydrate === 'function') {
            module.hydrate(preloadedState);
          }
        }
        
        return module;
      }
    }
  `;
  
  // Insert SSR utilities after the Promise constructor
  return template.replace(
    'return new Promise((resolve, reject) => {',
    'return new Promise((resolve, reject) => {' + ssrCode
  );
}

/**
 * Injects circuit breaker into the template
 */
function injectCircuitBreaker(template: string): string {
  const circuitBreakerCode = `
    // Circuit breaker implementation
    class CircuitBreaker {
      constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 30000;
        this.failureCount = 0;
        this.state = 'CLOSED';
        this.nextAttempt = Date.now();
      }
      
      execute(fn) {
        if (this.state === 'OPEN') {
          if (Date.now() < this.nextAttempt) {
            throw new Error('Circuit breaker is OPEN');
          }
          
          // Switch to half-open state
          this.state = 'HALF-OPEN';
        }
        
        try {
          const result = fn();
          this.onSuccess();
          return result;
        } catch (error) {
          this.onFailure();
          throw error;
        }
      }
      
      onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
      }
      
      onFailure() {
        this.failureCount++;
        
        if (this.failureCount >= this.failureThreshold || this.state === 'HALF-OPEN') {
          this.state = 'OPEN';
          this.nextAttempt = Date.now() + this.resetTimeout;
        }
      }
    }
    
    // Create a circuit breaker for this remote
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 10000
    });
  `;
  
  // Find appropriate place to insert circuit breaker logic
  return template.replace(
    'function attemptLoadWithRetry() {',
    circuitBreakerCode + '\n    function attemptLoadWithRetry() {'
  ).replace(
    'fetch(edgeUrl, { method: \'HEAD\' })',
    'circuitBreaker.execute(() => fetch(edgeUrl, { method: \'HEAD\' }))'
  );
}

/**
 * Original delegate module template for MF 1.0
 */
function xpack_delegate_module_template(): unknown {
  return new Promise((resolve, reject) => {
    const _windows = typeof window !== 'undefined' ? window : globalThis;
    const sessionEdgeURL = _windows.sessionStorage.getItem('__APPLICATION_UID__');

    const remote_entry_url = '__REMOTE_ENTRY_URL__';
    const library_type = '__LIBRARY_TYPE__';
    let edgeUrl = sessionEdgeURL ?? remote_entry_url;
    let remote_name = '__REMOTE_NAME__';

    if (edgeUrl.indexOf('@') !== -1) {
      [remote_name, edgeUrl] = edgeUrl.split('@') as [string, string];
    }

    const resolve_entry = [
      fetch(edgeUrl, { method: 'HEAD' })
        .then(() => edgeUrl)
        .catch(() => false),
    ];

    Promise.race(resolve_entry)
      .then((remoteUrl) => {
        if (typeof remoteUrl !== 'string') return;
        const _win = _windows as unknown as Record<string, unknown>;

        if (typeof _win[remote_name] !== 'undefined') {
          return resolve(_win[remote_name]);
        }

        if (
          typeof __webpack_require__ !== 'undefined' &&
          typeof __webpack_require__.l === 'function' &&
          // @ts-expect-error - library_type is inherited enum type instead of string
          library_type !== 'module'
        ) {
          __webpack_require__.l(
            remoteUrl,
            () => {
              resolve(_win[remote_name]);
            },
            remote_name,
            remote_name
          );
          return;
        }

        return new Function(`return import("${remoteUrl}")`)()
          .then((mod: unknown) => {
            if (typeof _win[remote_name] !== 'undefined') {
              return resolve(_win[remote_name]);
            }

            return resolve(mod);
          })
          .catch((err: unknown) => reject(err));
      })
      .catch((err) => {
        console.error(`Zephyr: error loading remote entry ${remote_entry_url}`, err);
      });
  });
}

/**
 * Enhanced delegate module template for MF 2.0
 */
function mf2_delegate_module_template(): unknown {
  return new Promise((resolve, reject) => {
    const _windows = typeof window !== 'undefined' ? window : globalThis;
    const sessionEdgeURL = _windows.sessionStorage.getItem('__APPLICATION_UID__');

    const remote_entry_url = '__REMOTE_ENTRY_URL__';
    const library_type = '__LIBRARY_TYPE__';
    let edgeUrl = sessionEdgeURL ?? remote_entry_url;
    let remote_name = '__REMOTE_NAME__';

    if (edgeUrl.indexOf('@') !== -1) {
      [remote_name, edgeUrl] = edgeUrl.split('@') as [string, string];
    }

    // Maximum number of retries
    const MAX_RETRIES = 3;
    // Initial delay in milliseconds
    const INITIAL_DELAY = 300;
    // Current retry count
    let retryCount = 0;

    /**
     * Attempt to load the remote with retry logic
     */
    function attemptLoadWithRetry() {
      // Try to fetch the remote
      fetch(edgeUrl, { method: 'HEAD' })
        .then(() => {
          loadRemote(edgeUrl);
        })
        .catch((error) => {
          console.warn(`Zephyr: error checking remote ${edgeUrl}, attempt ${retryCount + 1}/${MAX_RETRIES}`, error);
          
          // Retry with exponential backoff if we haven't reached max retries
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = INITIAL_DELAY * Math.pow(2, retryCount - 1);
            setTimeout(attemptLoadWithRetry, delay);
          } else {
            console.error(`Zephyr: failed to load remote after ${MAX_RETRIES} retries: ${remote_entry_url}`);
          }
        });
    }

    /**
     * Load the remote module
     */
    function loadRemote(remoteUrl: string) {
      const _win = _windows as unknown as Record<string, unknown>;

      // Check if the remote is already loaded in the global scope
      if (typeof _win[remote_name] !== 'undefined') {
        return resolve(_win[remote_name]);
      }

      // For webpack/rspack with non-module library type
      if (
        typeof __webpack_require__ !== 'undefined' &&
        typeof __webpack_require__.l === 'function' &&
        library_type !== 'module'
      ) {
        __webpack_require__.l(
          remoteUrl,
          () => {
            resolve(_win[remote_name]);
          },
          remote_name,
          remote_name
        );
        return;
      }

      // For ESM and MF 2.0
      new Function(`return import("${remoteUrl}")`)()
        .then((mod: unknown) => {
          // Check if the remote was exposed in the global scope
          if (typeof _win[remote_name] !== 'undefined') {
            return resolve(_win[remote_name]);
          }

          // Check if the module has a 'get' method (MF 2.0 container protocol)
          if (mod && typeof mod === 'object' && 'get' in mod && typeof mod.get === 'function') {
            return resolve(mod);
          }

          // Fallback to the whole module
          return resolve(mod);
        })
        .catch((err: unknown) => {
          console.error(`Zephyr: error importing module: ${remoteUrl}`, err);
          reject(err);
        });
    }

    // Start the loading process
    attemptLoadWithRetry();
  });
}

/**
 * Runtime plugin types for MF 2.0
 */
interface RuntimePlugin {
  name: string;
  beforeInit?(args: any): any;
  beforeRequest?(args: any): any;
  afterResolve?(args: any): any;
  onLoad?(args: any): any;
  errorLoadRemote?(args: any): any;
  beforeLoadShare?(args: any): any;
  createScript?(args: any): any;
}

/**
 * Retry plugin configuration
 */
interface RetryPluginConfig {
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
 * Create a retry plugin for MF 2.0
 */
function createRetryPlugin(config: RetryPluginConfig = {}): RuntimePlugin {
  return {
    name: 'zephyr-retry-plugin',
    
    beforeRequest(args) {
      // Add retry logic for remote requests
      const { url, moduleName } = args;
      
      // Check if this module should use retry logic
      const shouldUseRetry = !config.script?.moduleName || 
        config.script.moduleName.includes(moduleName);
      
      if (shouldUseRetry) {
        args.retry = {
          times: config.script?.retryTimes || 3,
          delay: config.script?.retryDelay || 1000
        };
      }
      
      return args;
    },
    
    errorLoadRemote(args) {
      const { error, moduleName } = args;
      
      // Check if this is a fetch error and we have a fallback URL
      if (error.message && error.message.includes('fetch') && config.fetch?.fallback) {
        console.warn(`Zephyr: Failed to fetch module ${moduleName}, trying fallback`);
        
        const fallbackUrl = typeof config.fetch.fallback === 'function'
          ? config.fetch.fallback()
          : config.fetch.fallback;
        
        args.retryUrl = fallbackUrl;
        return args;
      }
      
      return args;
    }
  };
}

/**
 * Semver plugin configuration
 */
interface SemverPluginConfig {
  strictVersionCheck?: boolean;     // Whether to enforce strict version matching
  registryUrl?: string;             // URL for semver registry
  defaultRequirements?: Record<string, string>;  // Default version requirements
}

/**
 * Create a semver plugin for MF 2.0
 */
function createSemverPlugin(config: SemverPluginConfig = {}): RuntimePlugin {
  return {
    name: 'zephyr-semver-plugin',
    
    beforeRequest(args) {
      const { url, moduleName } = args;
      
      // Check if we have version requirements for this module
      if (config.defaultRequirements && config.defaultRequirements[moduleName]) {
        const requirement = config.defaultRequirements[moduleName];
        
        // Add version requirement to args
        args.versionRequirement = requirement;
        console.log(`Zephyr: Module ${moduleName} requires version ${requirement}`);
      }
      
      return args;
    },
    
    afterResolve(args) {
      const { resolvedUrl, moduleName, versionRequirement } = args;
      
      // Extract version from URL if possible
      if (versionRequirement && resolvedUrl) {
        const versionMatch = resolvedUrl.match(/\/v([\d.]+(?:-[\w.-]+)?(?:\+[\w.-]+)?)\//) || [];
        const version = versionMatch[1];
        
        if (version) {
          console.log(`Zephyr: Resolved ${moduleName} to version ${version}`);
          
          // Store resolved version for reference
          args.resolvedVersion = version;
        }
      }
      
      return args;
    }
  };
}

/**
 * SSR plugin configuration
 */
interface SSRPluginConfig {
  preloadRemotes?: boolean;         // Whether to preload remotes during SSR
  hydrateOnLoad?: boolean;          // Whether to hydrate components on load
  streamingEnabled?: boolean;       // Whether to enable streaming SSR
}

/**
 * Create an SSR plugin for MF 2.0
 */
function createSSRPlugin(config: SSRPluginConfig = {}): RuntimePlugin {
  return {
    name: 'zephyr-ssr-plugin',
    
    beforeInit(args) {
      // Check if we're in an SSR environment
      const isSSR = typeof window === 'undefined';
      
      // Set SSR flag
      args.isSSR = isSSR;
      
      // If in SSR mode and preloading is enabled, prepare for preloading
      if (isSSR && config.preloadRemotes) {
        args.preloadRemotes = true;
      }
      
      return args;
    },
    
    onLoad(args) {
      const { module, moduleName, isSSR } = args;
      
      // If in browser and hydration is enabled, try to hydrate
      if (!isSSR && config.hydrateOnLoad && typeof window !== 'undefined') {
        const store = window.__ZEPHYR_SSR_STORE || {};
        const preloadedState = store[moduleName];
        
        if (preloadedState && module) {
          console.log(`Zephyr: Hydrating module ${moduleName}`);
          
          // If module has a hydrate method, call it
          if (typeof module.hydrate === 'function') {
            module.hydrate(preloadedState);
          }
        }
      }
      
      return args;
    }
  };
}

/**
 * Create initialization code for runtime plugins
 */
function createRuntimePluginsInitCode(plugins: Array<string | RuntimePlugin>): string {
  if (!plugins || plugins.length === 0) {
    return '';
  }
  
  // Create code to register plugins
  return `
// Register Zephyr runtime plugins
const registerPlugins = (plugins) => {
  if (typeof window !== 'undefined' && window.__ZEPHYR_FEDERATION__) {
    if (typeof window.__ZEPHYR_FEDERATION__.registerPlugins === 'function') {
      window.__ZEPHYR_FEDERATION__.registerPlugins(plugins);
    } else if (typeof window.__ZEPHYR_FEDERATION__.registerGlobalPlugins === 'function') {
      window.__ZEPHYR_FEDERATION__.registerGlobalPlugins(plugins);
    }
  }
};

// Plugin definitions
const zephyrPlugins = [
${plugins.map(plugin => {
  if (typeof plugin === 'string') {
    // Path to plugin file
    return `  require("${plugin}")(),`;
  } else {
    // Inline plugin definition
    return `  ${JSON.stringify(plugin, null, 2)},`;
  }
}).join('\n')}
];

// Register plugins
registerPlugins(zephyrPlugins);
`;
}

/**
 * Exports
 */
export {
  ZeResolvedDependency,
  RuntimeCodeOptions,
  createMfRuntimeCode,
  createMF1RuntimeCode,
  createMF2RuntimeCode,
  xpack_delegate_module_template,
  mf2_delegate_module_template,
  RuntimePlugin,
  RetryPluginConfig,
  SemverPluginConfig,
  SSRPluginConfig,
  createRetryPlugin,
  createSemverPlugin,
  createSSRPlugin,
  createRuntimePluginsInitCode
};