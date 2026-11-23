import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser';
import { ZeErrors, ZephyrError } from 'zephyr-agent';
import type { ZephyrBuildTarget } from 'zephyr-edge-contract';
import { RELATIVE_PATH_RULE } from './path-rules';

export const ZEPHYR_CONFIG_FILE_NAME = 'zephyr.config.json';

/** Contract versions this CLI can read. Keep in step with the schema `version` enum. */
export const SUPPORTED_CONFIG_VERSIONS: readonly string[] = ['1.0.0'];

/** Contents of a `zephyr.config.json`. Owner: ze-cli (SC-04). */
export interface ZephyrConfig {
  $schema?: string;
  version: string;
  output: string;
  include: string[];
  exclude?: string[];
  target?: ZephyrBuildTarget;
  metadata?: string;
}

function configError(
  path: string,
  message: string,
  cause?: unknown
): ZephyrError<'ERR_UNKNOWN'> {
  return new ZephyrError(ZeErrors.ERR_UNKNOWN, {
    message: `Invalid ${path}: ${message}`,
    ...(cause === undefined ? {} : { cause }),
  });
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

/**
 * The schema ships in the package (`schema/`), one level above both `src/lib` and
 * `dist/lib`, so the same relative path works from source, tests and the built CLI.
 */
const SCHEMA_PATH = join(__dirname, '..', '..', 'schema', 'zephyr.config.schema.json');

let compiled: Promise<ValidateFunction> | undefined;

function getValidator(): Promise<ValidateFunction> {
  if (compiled === undefined) {
    const attempt = readFile(SCHEMA_PATH, 'utf8').then((text) =>
      new Ajv2020({ allErrors: true }).compile(JSON.parse(text))
    );
    // A failed load (for example a missing schema file) must not be remembered, or every
    // later call in this process would fail with the same stale rejection.
    attempt.catch(() => {
      if (compiled === attempt) compiled = undefined;
    });
    compiled = attempt;
  }
  return compiled;
}

function formatAjvError(error: ErrorObject): string {
  const location = error.instancePath === '' ? '(root)' : error.instancePath;
  if (error.keyword === 'enum' && error.instancePath === '/version') {
    return `${location} must be one of the supported versions: ${SUPPORTED_CONFIG_VERSIONS.join(', ')}`;
  }
  if (error.keyword === 'pattern') {
    return `${location} ${RELATIVE_PATH_RULE}`;
  }
  if (error.keyword === 'additionalProperties') {
    const property = String(
      (error.params as { additionalProperty?: unknown }).additionalProperty
    );
    return `${location} has an unknown property "${property}"`;
  }
  return `${location} ${error.message ?? 'is invalid'}`;
}

/**
 * Where the config lives: the explicit `--config` path, else
 * `<folder>/zephyr.config.json`. Relative paths resolve from `cwd`; the default location
 * resolves from the folder.
 */
export function resolveConfigPath(
  folder: string,
  explicit: string | undefined,
  cwd: string
): { path: string; explicit: boolean } {
  if (explicit !== undefined) {
    return {
      path: isAbsolute(explicit) ? explicit : resolve(cwd, explicit),
      explicit: true,
    };
  }
  return { path: join(folder, ZEPHYR_CONFIG_FILE_NAME), explicit: false };
}

/**
 * Reads and validates a config. Returns `undefined` when there is no file at the default
 * location; an explicit path that does not exist is an error.
 */
export async function loadZephyrConfig(location: {
  path: string;
  explicit: boolean;
}): Promise<ZephyrConfig | undefined> {
  const { path } = location;
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (isNotFound(error)) {
      if (location.explicit) throw configError(path, 'the file does not exist.');
      return undefined;
    }
    throw configError(path, 'the file cannot be read.', error);
  }

  const parseErrors: ParseError[] = [];
  const parsed: unknown = parse(text, parseErrors, { allowTrailingComma: true });
  if (parseErrors.length > 0) {
    const details = parseErrors
      .map((e) => `${printParseErrorCode(e.error)} at offset ${e.offset}`)
      .join('; ');
    throw configError(path, `it is not valid JSON (${details}).`);
  }

  const validate = await getValidator();
  if (!validate(parsed)) {
    const details = (validate.errors ?? []).map(formatAjvError).join('; ');
    throw configError(path, details);
  }
  return parsed as ZephyrConfig;
}

/** Folder that relative paths inside a config (`output`, `metadata`) resolve from. */
export function configDirectory(configPath: string): string {
  return dirname(configPath);
}
