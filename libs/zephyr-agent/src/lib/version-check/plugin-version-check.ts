import { readFileSync } from 'node:fs';
import dns from 'node:dns/promises';
import { join } from 'node:path';
import { logFn } from '../logging/ze-log-event';

const DEFAULT_VERSION_RECORD = '_ze_version.zephyr-cloud.io';

let cachedVersion: string | null = null;

export function parseTxtFields(content: string): Map<string, string> {
  const fields = new Map<string, string>();

  for (const part of content.split(';')) {
    const segment = part.trim();
    if (!segment) continue;

    const separatorIndex = segment.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = segment.slice(0, separatorIndex).trim();
    const value = segment.slice(separatorIndex + 1).trim();
    if (!key || !value) continue;

    fields.set(key, value);
  }

  return fields;
}

export function parseTxtRecord(records: string[][]): Map<string, string> {
  for (const chunks of records) {
    const fields = parseTxtFields(chunks.join(''));
    if (fields.has('latest')) {
      return fields;
    }
  }

  return new Map<string, string>();
}

export function compareSemver(
  currentVersion: string,
  latestVersion: string
): number | null {
  const normalize = (value: string): [number, number, number] | null => {
    const clean = value.trim().replace(/^v/i, '').split('-', 1)[0];
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(clean);
    if (!match) return null;

    return [
      Number.parseInt(match[1], 10),
      Number.parseInt(match[2], 10),
      Number.parseInt(match[3], 10),
    ];
  };

  const current = normalize(currentVersion);
  const latest = normalize(latestVersion);
  if (!current || !latest) {
    return null;
  }

  for (let index = 0; index < 3; index += 1) {
    if (current[index] < latest[index]) return -1;
    if (current[index] > latest[index]) return 1;
  }
  return 0;
}

function getCurrentPluginVersion(): string | null {
  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    const packageJsonPath = join(__dirname, '../../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
      version?: string;
    };
    cachedVersion = packageJson.version ?? null;
    return cachedVersion;
  } catch {
    return null;
  }
}

export async function checkPluginVersionWarning(deps?: {
  resolveTxt?: (hostname: string) => Promise<string[][]>;
  logger?: typeof logFn;
  currentVersion?: string | null;
}): Promise<void> {
  const resolveTxt = deps?.resolveTxt ?? dns.resolveTxt;
  const logger = deps?.logger ?? logFn;
  const host = DEFAULT_VERSION_RECORD;

  try {
    const txtRecords = await resolveTxt(host);
    const fields = parseTxtRecord(txtRecords);
    const latest = fields.get('latest');

    if (!latest) {
      return;
    }

    const current = deps?.currentVersion ?? getCurrentPluginVersion();
    if (!current) {
      return;
    }

    const comparison = compareSemver(current, latest);
    if (comparison === null || comparison >= 0) {
      return;
    }

    const msg =
      fields.get('msg') ?? 'Please upgrade to the latest Zephyr plugin version.';
    logger(
      'warn',
      `[Zephyr] Update available: ${current} -> ${latest}. ${msg}`,
      'build:warn:plugin_version'
    );
  } catch {
    // Version checks are best-effort and must never affect plugin behavior.
  }
}
