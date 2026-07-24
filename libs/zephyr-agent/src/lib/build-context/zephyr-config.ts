import { existsSync, realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { createJiti } from 'jiti';
import { ZeErrors, ZephyrError } from '../errors';
import { redactString } from '../security/redaction';

/** User-authored Zephyr project configuration. */
export type ZephyrDependencyUrlMode = 'selector' | 'version';

export interface ZephyrConfig {
  /** Overrides the organization inferred from the Git remote. */
  org?: string;
  /** Overrides the project inferred from the Git remote. */
  project?: string;
  /** Overrides the application name read from package.json. */
  appName?: string;
  /** Adds to package.json zephyr:dependencies; config entries win by key. */
  remoteDependencies?: Record<string, string>;
  /** Chooses mutable selector URLs or immutable version URLs for resolved remotes. */
  dependencyUrlMode?: ZephyrDependencyUrlMode;
}

export type ResolvedZephyrConfig = Readonly<
  Omit<ZephyrConfig, 'remoteDependencies'> & {
    remoteDependencies?: Readonly<Record<string, string>>;
  }
>;

const CONFIG_FILE_NAMES = [
  'zephyr.config.ts',
  'zephyr.config.mts',
  'zephyr.config.cts',
  'zephyr.config.js',
  'zephyr.config.mjs',
  'zephyr.config.cjs',
] as const;

const CONFIG_FIELDS = new Set<keyof ZephyrConfig>([
  'org',
  'project',
  'appName',
  'remoteDependencies',
  'dependencyUrlMode',
]);

const CONFIG_ERROR_MAX_LENGTH = 1_000;

interface CachedConfig {
  fingerprint: string;
  config: ResolvedZephyrConfig;
}

const configCache = new Map<string, CachedConfig>();

/** Provides contextual typing without changing the supplied configuration. */
export function defineConfig(config: ZephyrConfig): ZephyrConfig {
  return config;
}

/** Normalize a bundler context to the directory all project-local reads must use. */
export function resolveZephyrContextDirectory(context?: string): string {
  const startingPath = context?.trim() || process.cwd();
  const absolutePath = isAbsolute(startingPath)
    ? startingPath
    : resolve(process.cwd(), startingPath);

  try {
    return statSync(absolutePath).isFile() ? dirname(absolutePath) : absolutePath;
  } catch {
    // Bundlers can provide a path before all output directories exist. Treat it as a
    // directory; callers which require it to exist will return their domain error.
    return absolutePath;
  }
}

/** Load and validate the nearest Zephyr config without reading environment overrides. */
export function getZephyrConfig(context?: string): ResolvedZephyrConfig {
  const configPath = findConfigPath(resolveZephyrContextDirectory(context));
  if (!configPath) {
    return Object.freeze({});
  }

  const canonicalPath = getCanonicalConfigPath(configPath);
  const fingerprint = getConfigFingerprint(canonicalPath);
  const cached = configCache.get(canonicalPath);
  if (cached?.fingerprint === fingerprint) {
    return cached.config;
  }

  const config = loadConfigModule(canonicalPath);
  configCache.set(canonicalPath, { fingerprint, config });
  return config;
}

/** Merge config dependencies over package dependencies without mutating either input. */
export function mergeRemoteDependencies(
  packageDependencies: Record<string, string> | undefined,
  config: ResolvedZephyrConfig
): Record<string, string> | undefined {
  if (!packageDependencies && !config.remoteDependencies) {
    return undefined;
  }

  return {
    ...packageDependencies,
    ...config.remoteDependencies,
  };
}

function findConfigPath(startingDirectory: string): string | undefined {
  let directory = startingDirectory;

  while (true) {
    const matches = CONFIG_FILE_NAMES.map((fileName) => join(directory, fileName)).filter(
      isFile
    );

    if (matches.length > 1) {
      throwConfigError(
        directory,
        `multiple config files found: ${matches.map((file) => basename(file)).join(', ')}`
      );
    }
    if (matches[0]) {
      return matches[0];
    }

    const parent = dirname(directory);
    if (parent === directory) {
      return undefined;
    }
    directory = parent;
  }
}

function isFile(filePath: string): boolean {
  try {
    return existsSync(filePath) && statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function getCanonicalConfigPath(configPath: string): string {
  try {
    return realpathSync(configPath);
  } catch (error: unknown) {
    throwConfigError(
      configPath,
      `failed to resolve config path: ${safeConfigErrorMessage(error)}`
    );
  }
}

function getConfigFingerprint(configPath: string): string {
  try {
    const stats = statSync(configPath);
    return `${stats.mtimeMs}:${stats.size}`;
  } catch (error: unknown) {
    throwConfigError(
      configPath,
      `failed to inspect config: ${safeConfigErrorMessage(error)}`
    );
  }
}

function loadConfigModule(configPath: string): ResolvedZephyrConfig {
  try {
    // Jiti's moduleCache:false does not evict a native .cjs require performed by a prior
    // Jiti instance. The stat fingerprint has already changed, so evict only this exact
    // config entry before re-executing it; unchanged reads return from configCache above.
    const requireFromConfig = createRequire(configPath);
    delete requireFromConfig.cache[configPath];
    const jiti = createJiti(configPath, {
      interopDefault: true,
      moduleCache: false,
    });
    const loaded = jiti(configPath) as { default?: unknown } | unknown;
    const config =
      isObject(loaded) && 'default' in loaded ? loaded['default'] : (loaded as unknown);
    return parseConfig(config, configPath);
  } catch (error: unknown) {
    if (ZephyrError.is(error, ZeErrors.ERR_ZEPHYR_CONFIG_NOT_VALID)) {
      throw error;
    }

    throwConfigError(
      configPath,
      `failed to load config: ${safeConfigErrorMessage(error)}`
    );
  }
}

function parseConfig(value: unknown, configPath: string): ResolvedZephyrConfig {
  if (!isObject(value)) {
    throwConfigError(configPath, 'default export must be an object');
  }

  const unknownFields = Object.keys(value).filter(
    (field) => !CONFIG_FIELDS.has(field as keyof ZephyrConfig)
  );
  if (unknownFields.length > 0) {
    throwConfigError(
      configPath,
      `unknown field${unknownFields.length === 1 ? '' : 's'}: ${unknownFields.join(', ')}`
    );
  }

  const org = readOptionalString(value['org'], 'org', configPath);
  const project = readOptionalString(value['project'], 'project', configPath);
  const appName = readOptionalString(value['appName'], 'appName', configPath);
  const remoteDependencies = readRemoteDependencies(
    value['remoteDependencies'],
    configPath
  );
  const dependencyUrlMode = readDependencyUrlMode(value['dependencyUrlMode'], configPath);

  return Object.freeze({
    ...(org ? { org } : {}),
    ...(project ? { project } : {}),
    ...(appName ? { appName } : {}),
    ...(remoteDependencies ? { remoteDependencies } : {}),
    ...(dependencyUrlMode ? { dependencyUrlMode } : {}),
  });
}

function readDependencyUrlMode(
  value: unknown,
  configPath: string
): ZephyrDependencyUrlMode | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value !== 'selector' && value !== 'version') {
    throwConfigError(
      configPath,
      'dependencyUrlMode must be either "selector" or "version"'
    );
  }
  return value;
}

function readOptionalString(
  value: unknown,
  field: 'org' | 'project' | 'appName',
  configPath: string
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throwConfigError(configPath, `${field} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throwConfigError(configPath, `${field} must not be empty`);
  }
  return normalized;
}

function readRemoteDependencies(
  value: unknown,
  configPath: string
): Readonly<Record<string, string>> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isObject(value)) {
    throwConfigError(
      configPath,
      'remoteDependencies must be an object with string values'
    );
  }

  const dependencies: Record<string, string> = {};
  for (const [name, reference] of Object.entries(value)) {
    if (!name.trim()) {
      throwConfigError(configPath, 'remoteDependencies keys must not be empty');
    }
    if (typeof reference !== 'string') {
      throwConfigError(configPath, `remoteDependencies.${name} must be a string`);
    }
    if (!reference.trim()) {
      throwConfigError(configPath, `remoteDependencies.${name} must not be empty`);
    }
    dependencies[name] = reference.trim();
  }
  return Object.freeze(dependencies);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeConfigErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const redacted = redactString(rawMessage);
  if (redacted.length <= CONFIG_ERROR_MAX_LENGTH) {
    return redacted;
  }
  return `${redacted.slice(0, CONFIG_ERROR_MAX_LENGTH)}…[truncated]`;
}

function throwConfigError(configPath: string, message: string): never {
  throw new ZephyrError(ZeErrors.ERR_ZEPHYR_CONFIG_NOT_VALID, {
    message: `at ${configPath}: ${safeConfigErrorMessage(message)}`,
  });
}
