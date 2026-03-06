import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { safe_json_parse } from 'zephyr-edge-contract';
import { fetchWithRetries } from '../http/fetch-with-retries';
import { brightRedBgName } from '../logging/debug';
import { getZephyrAgentVersion } from './zephyr-agent-version';

const warnedVersionPairs = new Set<string>();
const NPM_FETCH_TIMEOUT_MS = 1_500;
const requireFromHere = createRequire(__filename);

function parseSemver(version: string): [number, number, number] | null {
  const sanitized = version.trim().replace(/^v/i, '');
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(sanitized);

  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isOlderVersion(currentVersion: string, latestVersion: string): boolean {
  const current = parseSemver(currentVersion);
  const latest = parseSemver(latestVersion);

  if (!current || !latest) {
    return false;
  }

  if (current[0] !== latest[0]) {
    return current[0] < latest[0];
  }

  if (current[1] !== latest[1]) {
    return current[1] < latest[1];
  }

  return current[2] < latest[2];
}

async function fetchLatestVersion(packageName: string): Promise<string | null> {
  const npmDistTagsUrl = new URL(
    `https://registry.npmjs.org/-/package/${encodeURIComponent(packageName)}/dist-tags`
  );
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), NPM_FETCH_TIMEOUT_MS);

  try {
    const response = await fetchWithRetries(
      npmDistTagsUrl,
      { signal: abortController.signal },
      2
    );
    const payload = (await response.json()) as { latest?: unknown };
    return typeof payload.latest === 'string' ? payload.latest : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function resolveInstalledPluginVersion(pluginPackageName: string): string {
  try {
    const packageJsonPath = requireFromHere.resolve(`${pluginPackageName}/package.json`, {
      paths: [process.cwd()],
    });
    const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
    const parsed = safe_json_parse<{ version?: unknown }>(packageJsonContent);

    if (parsed?.version && typeof parsed.version === 'string') {
      return parsed.version;
    }
  } catch {
    // Ignore and fallback to zephyr-agent version.
  }

  return getZephyrAgentVersion();
}

export async function maybeShowOutdatedPluginWarning(
  pluginPackageName: string
): Promise<void> {
  const currentVersion = resolveInstalledPluginVersion(pluginPackageName);
  const latestVersion = await fetchLatestVersion(pluginPackageName);

  if (!latestVersion) {
    return;
  }

  if (!isOlderVersion(currentVersion, latestVersion)) {
    return;
  }

  const versionPair = `${pluginPackageName}:${currentVersion}->${latestVersion}`;
  if (warnedVersionPairs.has(versionPair)) {
    return;
  }
  warnedVersionPairs.add(versionPair);

  const message = [
    `${brightRedBgName}  Your Zephyr Plugin version is outdated (current: ${currentVersion}, latest: ${latestVersion}).`,
    `${brightRedBgName}  Older versions can cause unexpected build and deployment issues.`,
    `${brightRedBgName}  If you are facing any issue, upgrade ${pluginPackageName} first.`,
  ].join('\n');

  console.error(message);
}

export function resetOutdatedPluginWarningStateForTests(): void {
  warnedVersionPairs.clear();
}
