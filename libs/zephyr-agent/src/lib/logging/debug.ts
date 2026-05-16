// light weight functions for decorated console.error + able to toggle different parts of whole module's logging result
import type { createDebug as createObugDebug, Debugger } from 'obug';
import {
  bgCyanBright,
  bgGreenBright,
  bgRedBright,
  bgYellowBright,
  black,
  bold,
  dim,
} from './picocolor';
import { writeLogToFile, isFileLoggingEnabled } from './file-logger';

//TODO: this should be traced and logged into new relic
const name = ' ZEPHYR ';

export const dimmedName = dim(name);

export const brightBlueBgName = bold(bgCyanBright(black(name)));

export const brightYellowBgName = bold(bgYellowBright(black(name)));

export const brightGreenBgName = bold(bgGreenBright(black(name)));

export const brightRedBgName = bold(bgRedBright(black(name)));

/** Wrap debug logger to support file logging */
type DebugLogger = Debugger;

type ObugModule = { createDebug: typeof createObugDebug };

const importObug = new Function('return import("obug")') as () => Promise<ObugModule>;
const loggerPromises = new Map<string, Promise<DebugLogger>>();

function debugPatternToRegExp(pattern: string): RegExp {
  return new RegExp(
    `^${pattern.replace(/[|\\{}()[\]^$+?.]/g, '\\$&').replace(/\*/g, '.*?')}$`
  );
}

function isNamespaceEnabled(namespace: string): boolean {
  const debugEnv = process.env['DEBUG'];
  if (!debugEnv) return false;

  const patterns = debugEnv.split(/[\s,]+/).filter(Boolean);
  const skips = patterns
    .filter((pattern) => pattern.startsWith('-'))
    .map((pattern) => debugPatternToRegExp(pattern.slice(1)));

  if (skips.some((pattern) => pattern.test(namespace))) {
    return false;
  }

  return patterns
    .filter((pattern) => !pattern.startsWith('-'))
    .map(debugPatternToRegExp)
    .some((pattern) => pattern.test(namespace));
}

function getLogger(namespace: string): Promise<DebugLogger> {
  let loggerPromise = loggerPromises.get(namespace);

  if (!loggerPromise) {
    loggerPromise = importObug().then(({ createDebug }) => createDebug(namespace));
    loggerPromises.set(namespace, loggerPromise);
  }

  return loggerPromise;
}

function createDebugLogger(namespace: string): DebugLogger {
  const logger = ((...args: Parameters<DebugLogger>) => {
    if (!isNamespaceEnabled(namespace)) return;

    void getLogger(namespace).then((debugLogger) => debugLogger(...args));
  }) as DebugLogger;

  Object.defineProperties(logger, {
    enabled: { get: () => isNamespaceEnabled(namespace) },
    namespace: { value: namespace },
  });

  return logger;
}

function wrapDebugLogger(logger: DebugLogger, context: string): DebugLogger {
  const wrappedFn = (...args: Parameters<DebugLogger>) => {
    const message = args
      .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
      .join(' ');

    // Always write to file if file logging is enabled, regardless of DEBUG env var
    if (isFileLoggingEnabled()) {
      writeLogToFile({
        level: 'debug',
        message,
        action: `debug:${context}`,
        timestamp: Date.now(),
      });
    }

    // Only output to console if DEBUG env var matches
    if (!logger.enabled) return;
    logger(...args);
  };

  return Object.assign(wrappedFn, {
    enabled: logger.enabled,
    namespace: logger.namespace,
  }) as DebugLogger;
}

const rawLoggers = {
  app: createDebugLogger('zephyr:app'),
  auth: createDebugLogger('zephyr:auth'),
  buildstats: createDebugLogger('zephyr:buildstats'),
  config: createDebugLogger('zephyr:config'),
  git: createDebugLogger('zephyr:git'),
  http: createDebugLogger('zephyr:http'),
  init: createDebugLogger('zephyr:init'),
  manifest: createDebugLogger('zephyr:manifest'),
  mf: createDebugLogger('zephyr:mf'),
  misc: createDebugLogger('zephyr:misc'),
  package: createDebugLogger('zephyr:package'),
  remotes: createDebugLogger('zephyr:remotes'),
  snapshot: createDebugLogger('zephyr:snapshot'),
  upload: createDebugLogger('zephyr:upload'),
  debug: createDebugLogger('zephyr:debug'),
  error: createDebugLogger('zephyr:error'),
};

export const ze_error = wrapDebugLogger(rawLoggers.error, 'error');
export const ze_debug = wrapDebugLogger(rawLoggers.debug, 'debug');

const createLogger = () => {
  return {
    app: wrapDebugLogger(rawLoggers.app, 'app'),
    auth: wrapDebugLogger(rawLoggers.auth, 'auth'),
    buildstats: wrapDebugLogger(rawLoggers.buildstats, 'buildstats'),
    config: wrapDebugLogger(rawLoggers.config, 'config'),
    git: wrapDebugLogger(rawLoggers.git, 'git'),
    http: wrapDebugLogger(rawLoggers.http, 'http'),
    init: wrapDebugLogger(rawLoggers.init, 'init'),
    manifest: wrapDebugLogger(rawLoggers.manifest, 'manifest'),
    mf: wrapDebugLogger(rawLoggers.mf, 'mf'),
    misc: wrapDebugLogger(rawLoggers.misc, 'misc'),
    package: wrapDebugLogger(rawLoggers.package, 'package'),
    remotes: wrapDebugLogger(rawLoggers.remotes, 'remotes'),
    snapshot: wrapDebugLogger(rawLoggers.snapshot, 'snapshot'),
    upload: wrapDebugLogger(rawLoggers.upload, 'upload'),
    debug: wrapDebugLogger(rawLoggers.debug, 'debug'),
    error: wrapDebugLogger(rawLoggers.error, 'error'),
  };
};

/**
 * Debug contexts:
 *
 * - Ze_log.app: Application config information
 * - Ze_log.auth: Authentication and token management
 * - Ze_log.buildstats: Build information for Dashboard API
 * - Ze_log.config: Authentication and token management
 * - Ze_log.git: Git configuration and provider
 * - Ze_log.http: http requests
 * - Ze_log.manifest: Generation and inclusion of zephyr manifest
 * - Ze_log.init: Initialization and setup operations
 * - Ze_log.manifest: Manifest generation and processing
 * - Ze_log.mf: Module Federation config
 * - Ze_log.misc: Miscellaneous
 * - Ze_log.package: Package.json parsing
 * - Ze_log.remotes: Remote dependency resolution
 * - Ze_log.snapshot: Snapshot publish
 * - Ze_log.upload: Asset and build stats upload
 */
export const ze_log = createLogger();
// If debug mode is not enabled just print whatever console output is
// If debug mode is enabled print the error from our end
