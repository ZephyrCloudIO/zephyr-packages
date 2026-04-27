// light weight functions for decorated console.error + able to toggle different parts of whole module's logging result
import debug from 'debug';
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
type DebugLogger = ((...args: unknown[]) => void) & {
  enabled?: boolean;
  namespace?: string;
};

function wrapDebugLogger(logger: DebugLogger, context: string): DebugLogger {
  const wrappedFn = (...args: unknown[]) => {
    const message = args
      .map((arg) =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      )
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
  app: debug('zephyr:app') as DebugLogger,
  auth: debug('zephyr:auth') as DebugLogger,
  buildstats: debug('zephyr:buildstats') as DebugLogger,
  config: debug('zephyr:config') as DebugLogger,
  git: debug('zephyr:git') as DebugLogger,
  http: debug('zephyr:http') as DebugLogger,
  init: debug('zephyr:init') as DebugLogger,
  manifest: debug('zephyr:manifest') as DebugLogger,
  mf: debug('zephyr:mf') as DebugLogger,
  misc: debug('zephyr:misc') as DebugLogger,
  package: debug('zephyr:package') as DebugLogger,
  remotes: debug('zephyr:remotes') as DebugLogger,
  snapshot: debug('zephyr:snapshot') as DebugLogger,
  upload: debug('zephyr:upload') as DebugLogger,
  debug: debug('zephyr:debug') as DebugLogger,
  error: debug('zephyr:error') as DebugLogger,
};

type ZeLoggers = {
  app: DebugLogger;
  auth: DebugLogger;
  buildstats: DebugLogger;
  config: DebugLogger;
  git: DebugLogger;
  http: DebugLogger;
  init: DebugLogger;
  manifest: DebugLogger;
  mf: DebugLogger;
  misc: DebugLogger;
  package: DebugLogger;
  remotes: DebugLogger;
  snapshot: DebugLogger;
  upload: DebugLogger;
  debug: DebugLogger;
  error: DebugLogger;
};

export const ze_error: DebugLogger = wrapDebugLogger(rawLoggers.error, 'error');
export const ze_debug: DebugLogger = wrapDebugLogger(rawLoggers.debug, 'debug');

const createLogger = (): ZeLoggers => {
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
export const ze_log: ZeLoggers = createLogger();
// If debug mode is not enabled just print whatever console output is
// If debug mode is enabled print the error from our end
