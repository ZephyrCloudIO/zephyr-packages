import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import type { AttributionContentOptions } from 'zephyr-edge-contract';

export interface AttributionConfig {
  schemaVersion: 1;
  enabled: boolean;
  /** Missing storage means local, including configurations written by older SDKs. */
  storage?: 'local' | 'remote';
  repositoryId?: string;
  content?: AttributionContentOptions;
  gitAiPath?: string;
  exclude?: string[];
}
function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
export function validateAttributionConfig(
  value: unknown
): asserts value is AttributionConfig {
  if (
    !object(value) ||
    Object.keys(value).some(
      (key) =>
        ![
          'schemaVersion',
          'enabled',
          'storage',
          'repositoryId',
          'content',
          'gitAiPath',
          'exclude',
        ].includes(key)
    ) ||
    value['schemaVersion'] !== 1 ||
    typeof value['enabled'] !== 'boolean' ||
    (value['storage'] !== undefined &&
      (typeof value['storage'] !== 'string' ||
        !['local', 'remote'].includes(value['storage']))) ||
    (value['repositoryId'] !== undefined &&
      (typeof value['repositoryId'] !== 'string' ||
        !/^[a-zA-Z0-9._-]{1,128}$/.test(value['repositoryId']))) ||
    (value['gitAiPath'] !== undefined && typeof value['gitAiPath'] !== 'string') ||
    (value['exclude'] !== undefined &&
      (!Array.isArray(value['exclude']) ||
        value['exclude'].some((prefix) => typeof prefix !== 'string' || !prefix))) ||
    (value['content'] !== undefined &&
      (!object(value['content']) ||
        Object.entries(value['content']).some(
          ([key, flag]) => !['patch', 'lines'].includes(key) || typeof flag !== 'boolean'
        )))
  )
    throw new Error(
      'Invalid attribution configuration; store only repository preferences, never credentials, URLs, or account tier'
    );
}
function readJson(filename: string): unknown {
  if (lstatSync(filename).isSymbolicLink())
    throw new Error('Attribution configuration cannot be a symlink');
  try {
    return JSON.parse(readFileSync(filename, 'utf8'));
  } catch {
    throw new Error('Invalid attribution configuration JSON');
  }
}

/** Private overrides can restrict sharing, never enable remote storage or more content. */
export function readAttributionConfig(
  root: string,
  gitDir?: string
): AttributionConfig | undefined {
  const filename = join(root, '.zephyr/attribution.json');
  if (!existsSync(filename)) return undefined;
  const config = readJson(filename);
  validateAttributionConfig(config);
  if (!gitDir) return config;
  const local = join(gitDir, 'zephyr-attribution/config.local.json');
  if (!existsSync(local)) return config;
  const override = readJson(local);
  if (
    !object(override) ||
    Object.keys(override).some((key) => !['storage', 'content'].includes(key)) ||
    (override['storage'] !== undefined && override['storage'] !== 'local') ||
    (override['content'] !== undefined &&
      (!object(override['content']) ||
        Object.entries(override['content']).some(
          ([key, flag]) => !['patch', 'lines'].includes(key) || flag !== false
        )))
  )
    throw new Error(
      'Private attribution overrides may only choose local storage or omit content'
    );
  return {
    ...config,
    ...(override['storage'] ? { storage: 'local' as const } : {}),
    content: { ...config.content, ...(override['content'] as AttributionContentOptions) },
  };
}

/** Atomic configuration writes. Neither shared nor private files accept secrets. */
export function writeAttributionConfig(
  root: string,
  gitDir: string,
  config: AttributionConfig,
  privateOverride = false
) {
  validateAttributionConfig(config);
  if (
    privateOverride &&
    (config.storage !== 'local' ||
      Object.values(config.content ?? {}).some((value) => value !== false))
  )
    throw new Error('Private overrides may only select local storage and omit content');
  const filename = privateOverride
    ? join(gitDir, 'zephyr-attribution/config.local.json')
    : join(root, '.zephyr/attribution.json');
  const directory = dirname(filename);
  if (existsSync(directory) && lstatSync(directory).isSymbolicLink())
    throw new Error('Attribution configuration directory cannot be a symlink');
  mkdirSync(directory, { recursive: true, mode: privateOverride ? 0o700 : 0o755 });
  if (existsSync(filename) && lstatSync(filename).isSymbolicLink())
    throw new Error('Attribution configuration cannot be a symlink');
  const temporary = join(directory, `.config-${randomUUID()}.tmp`);
  try {
    const value = privateOverride
      ? { storage: config.storage, content: config.content }
      : config;
    writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    renameSync(temporary, filename);
  } finally {
    rmSync(temporary, { force: true });
  }
}
