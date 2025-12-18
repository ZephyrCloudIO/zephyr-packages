/** Logger utility for OTA plugin with debug flag support */

const LOG_PREFIX = '[ZephyrOTA]';

let debugEnabled = false;

/** Enable or disable debug logging */
export function setDebugEnabled(enabled: boolean): void {
  debugEnabled = enabled;
}

/** Check if debug logging is enabled */
export function isDebugEnabled(): boolean {
  return debugEnabled;
}

/** Log a debug message (only when debug is enabled) */
export function logDebug(message: string, ...args: unknown[]): void {
  if (debugEnabled) {
    console.log(`${LOG_PREFIX} ${message}`, ...args);
  }
}

/** Log an info message (always logged) */
export function logInfo(message: string, ...args: unknown[]): void {
  console.log(`${LOG_PREFIX} ${message}`, ...args);
}

/** Log a warning message (always logged) */
export function logWarn(message: string, ...args: unknown[]): void {
  console.warn(`${LOG_PREFIX} ${message}`, ...args);
}

/** Log an error message (always logged) */
export function logError(message: string, ...args: unknown[]): void {
  console.error(`${LOG_PREFIX} ${message}`, ...args);
}

/** Create a scoped logger with a specific prefix */
export function createScopedLogger(scope: string): {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
} {
  const scopedPrefix = `${LOG_PREFIX}[${scope}]`;

  return {
    debug: (message: string, ...args: unknown[]) => {
      if (debugEnabled) {
        console.log(`${scopedPrefix} ${message}`, ...args);
      }
    },
    info: (message: string, ...args: unknown[]) => {
      console.log(`${scopedPrefix} ${message}`, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
      console.warn(`${scopedPrefix} ${message}`, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
      console.error(`${scopedPrefix} ${message}`, ...args);
    },
  };
}
