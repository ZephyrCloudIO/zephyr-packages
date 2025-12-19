/**
 * Logger utility for OTA plugin using debug package
 *
 * Enable debug output by setting DEBUG environment variable:
 *
 * - DEBUG=zephyr:ota:* - Enable all OTA logs
 * - DEBUG=zephyr:ota:api - Enable only API logs
 * - DEBUG=zephyr:ota:service - Enable only Service logs
 * - DEBUG=zephyr:* - Enable all Zephyr logs (including OTA)
 */
import debug from 'debug';

// Base namespace for OTA plugin - follows Zephyr ecosystem convention
const NAMESPACE = 'zephyr:ota';

// Pre-defined loggers for different scopes
const loggers = {
  api: debug(`${NAMESPACE}:api`),
  service: debug(`${NAMESPACE}:service`),
  storage: debug(`${NAMESPACE}:storage`),
  provider: debug(`${NAMESPACE}:provider`),
  detectRemotes: debug(`${NAMESPACE}:detect-remotes`),
  versionTracker: debug(`${NAMESPACE}:version-tracker`),
};

type LoggerScope = keyof typeof loggers;

/**
 * Enable debug logging programmatically
 *
 * This is an alternative to setting the DEBUG environment variable. Useful for React
 * Native where env vars may not be easily accessible.
 *
 * @param namespaces - Debug namespaces to enable (e.g., 'zephyr:ota:*')
 */
export function enableDebug(namespaces = `${NAMESPACE}:*`): void {
  debug.enable(namespaces);
}

/** Disable all debug logging */
export function disableDebug(): void {
  debug.disable();
}

/** Check if debug logging is enabled for a namespace */
export function isDebugEnabled(namespace: string = NAMESPACE): boolean {
  return debug.enabled(namespace);
}

/** @deprecated Use enableDebug('zephyr:ota:*') instead */
export function setDebugEnabled(enabled: boolean): void {
  if (enabled) {
    enableDebug();
  } else {
    disableDebug();
  }
}

/** Scoped logger interface */
export interface ScopedLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * Create a scoped logger with a specific prefix
 *
 * Uses the debug package with namespace pattern: zephyr:ota:<scope> Enable logs with
 * DEBUG=zephyr:ota:* or DEBUG=zephyr:ota:<scope>
 *
 * @param scope - Logger scope (e.g., 'API', 'Service', 'Storage')
 * @returns Scoped logger with debug, info, warn, error methods
 */
export function createScopedLogger(scope: string): ScopedLogger {
  // Normalize scope to lowercase and use predefined logger if available
  const normalizedScope = scope.toLowerCase().replace(/\s+/g, '-') as LoggerScope;
  const scopedDebug =
    loggers[normalizedScope] ?? debug(`${NAMESPACE}:${normalizedScope}`);
  const prefix = `[ZephyrOTA][${scope}]`;

  return {
    debug: (message: string, ...args: unknown[]) => {
      scopedDebug('%s %s', prefix, message, ...args);
    },
    info: (message: string, ...args: unknown[]) => {
      // Info logs always go to console.log for visibility
      console.log(`${prefix} ${message}`, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
      // Warnings always go to console.warn
      console.warn(`${prefix} ${message}`, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
      // Errors always go to console.error
      console.error(`${prefix} ${message}`, ...args);
    },
  };
}

// Export pre-configured loggers for direct use
export const ze_ota_log = {
  api: createScopedLogger('API'),
  service: createScopedLogger('Service'),
  storage: createScopedLogger('Storage'),
  provider: createScopedLogger('Provider'),
  detectRemotes: createScopedLogger('DetectRemotes'),
  versionTracker: createScopedLogger('VersionTracker'),
};
