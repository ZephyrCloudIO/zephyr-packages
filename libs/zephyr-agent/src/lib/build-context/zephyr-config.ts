import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import * as v from 'valibot';
import { safe_json_parse } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import type { ZeDependency } from './ze-package-json.type';
import { parseZeDependencies } from './ze-util-parse-ze-dependencies';

export interface ZephyrConfig {
  org?: string;
  project?: string;
  app?: string;
  env?: Record<string, string>;
  rawZephyrDependencies?: Record<string, string>;
  zephyrDependencies?: Record<string, ZeDependency>;
}

const CONFIG_FILE_NAMES = [
  'zephyr.config.ts',
  'zephyr.config.mts',
  'zephyr.config.cts',
  'zephyr.config.js',
  'zephyr.config.mjs',
  'zephyr.config.cjs',
] as const;

const CONFIG_FILE_FIELDS = ['org', 'project', 'appName', 'remoteDependencies'] as const;

const CONFIG_FILE_FIELD_SET = new Set<string>(CONFIG_FILE_FIELDS);

const stringRecordSchema = v.record(v.string(), v.string());

const zephyrConfigFileSchema = v.object({
  org: v.optional(v.string()),
  project: v.optional(v.string()),
  appName: v.optional(v.string()),
  remoteDependencies: v.optional(stringRecordSchema),
});

type ZephyrConfigFile = v.InferOutput<typeof zephyrConfigFileSchema>;
type ZephyrConfigIssue = v.InferIssue<typeof zephyrConfigFileSchema>;

function readString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function readEnvString(value: string | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseJsonEnv(value: string | undefined): Record<string, string> | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = safe_json_parse<unknown>(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined;
  }

  const entries = Object.entries(parsed).flatMap(([key, entry]) => {
    if (typeof entry !== 'string') {
      return [];
    }

    return [[key, entry] as const];
  });

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function readRawDependencies(
  value: Record<string, string> | undefined
): Record<string, string> | undefined {
  return value;
}

function findConfigPath(startingPath: string): string | undefined {
  let dir = startingPath;

  try {
    if (fs.existsSync(startingPath) && fs.statSync(startingPath).isFile()) {
      dir = path.dirname(startingPath);
    }
  } catch {
    dir = path.dirname(startingPath);
  }

  while (true) {
    for (const configFileName of CONFIG_FILE_NAMES) {
      const configPath = path.join(dir, configFileName);
      if (fs.existsSync(configPath) && fs.statSync(configPath).isFile()) {
        return configPath;
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }

    dir = parent;
  }
}

function readConfigFile(context: string | undefined): ZephyrConfig {
  const configPath = findConfigPath(context ?? process.cwd());
  if (!configPath) {
    return {};
  }

  const loadedConfig = loadConfigModule(configPath);
  const rawZephyrDependencies = readRawDependencies(loadedConfig.remoteDependencies);

  return {
    org: readString(loadedConfig.org),
    project: readString(loadedConfig.project),
    app: readString(loadedConfig.appName),
    rawZephyrDependencies,
    zephyrDependencies: rawZephyrDependencies
      ? parseZeDependencies(rawZephyrDependencies)
      : undefined,
  };
}

function loadConfigModule(configPath: string): ZephyrConfigFile {
  try {
    const jiti = createJiti(configPath, { interopDefault: true });
    const loaded = jiti(configPath) as {
      default?: unknown;
      __esModule?: boolean;
    };
    const config = loaded?.default ?? loaded;
    return parseConfigFile(config, configPath);
  } catch (error) {
    if (ZephyrError.is(error, ZeErrors.ERR_ZEPHYR_CONFIG_NOT_VALID)) {
      throw error;
    }

    throwConfigError(configPath, `failed to load config: ${(error as Error).message}`);
  }
}

function parseConfigFile(config: unknown, configPath: string): ZephyrConfigFile {
  if (!isConfigObject(config)) {
    throwConfigError(configPath, 'default export must be an object.');
  }

  const unknownFields = Object.keys(config).filter(
    (field) => !CONFIG_FILE_FIELD_SET.has(field)
  );

  if (unknownFields.length) {
    throwConfigError(
      configPath,
      `unknown field${unknownFields.length > 1 ? 's' : ''}: ${unknownFields.join(', ')}. ` +
        `Allowed fields: ${CONFIG_FILE_FIELDS.join(', ')}.`
    );
  }

  const result = v.safeParse(zephyrConfigFileSchema, config);
  if (!result.success) {
    throwConfigError(configPath, formatConfigValidationIssues(result.issues));
  }

  return result.output;
}

function isConfigObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatConfigValidationIssues(issues: ZephyrConfigIssue[]): string {
  const issue = issues[0];
  if (!issue) {
    return 'invalid config.';
  }

  const fieldPath = getIssueFieldPath(issue);
  if (issue.type === 'string' && fieldPath) {
    return `${fieldPath} must be a string.`;
  }

  if (issue.type === 'record' && fieldPath) {
    return `${fieldPath} must be an object with string values.`;
  }

  return issue.message;
}

function getIssueFieldPath(issue: ZephyrConfigIssue): string | undefined {
  const path = issue.path
    ?.map((pathItem) => pathItem.key)
    .filter((key): key is string | number => {
      return typeof key === 'string' || typeof key === 'number';
    });

  return path?.length ? path.join('.') : undefined;
}

function throwConfigError(configPath: string, message: string): never {
  throw new ZephyrError(ZeErrors.ERR_ZEPHYR_CONFIG_NOT_VALID, {
    message: `at ${configPath}: ${message}`,
  });
}

function readConfigFromEnv(): ZephyrConfig {
  const rawZephyrDependencies = parseJsonEnv(process.env['ZEPHYR_REMOTE_DEPENDENCIES']);

  return {
    org: readEnvString(process.env['ZEPHYR_ORG']),
    project: readEnvString(process.env['ZEPHYR_PROJECT']),
    app: readEnvString(process.env['ZEPHYR_APP_NAME']),
    env: parseJsonEnv(process.env['ZEPHYR_ENV_VARS']),
    rawZephyrDependencies,
    zephyrDependencies: rawZephyrDependencies
      ? parseZeDependencies(rawZephyrDependencies)
      : undefined,
  };
}

export function getZephyrConfig(context?: string): ZephyrConfig {
  const fileConfig = readConfigFile(context);
  const envConfig = readConfigFromEnv();

  return {
    org: envConfig.org ?? fileConfig.org,
    project: envConfig.project ?? fileConfig.project,
    app: envConfig.app ?? fileConfig.app,
    env: {
      ...fileConfig.env,
      ...envConfig.env,
    },
    rawZephyrDependencies:
      envConfig.rawZephyrDependencies ?? fileConfig.rawZephyrDependencies,
    zephyrDependencies: envConfig.zephyrDependencies ?? fileConfig.zephyrDependencies,
  };
}

export function applyZephyrConfigEnv(config: ZephyrConfig): void {
  for (const [key, value] of Object.entries(config.env ?? {})) {
    process.env[key] ??= value;
  }
}
