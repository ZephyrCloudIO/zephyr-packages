import { brightRedBgName } from '../logging/debug';
import { getZephyrAgentVersion } from './zephyr-agent-version';

const warnedVersionPairs = new Set<string>();

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
  if (typeof fetch !== 'function') {
    return null;
  }

  try {
    const response = await fetch(
      `https://registry.npmjs.org/-/package/${encodeURIComponent(packageName)}/dist-tags`
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { latest?: unknown };
    return typeof payload.latest === 'string' ? payload.latest : null;
  } catch {
    return null;
  }
}

export async function maybeShowOutdatedPluginWarning(
  pluginPackageName: string
): Promise<void> {
  const currentVersion = getZephyrAgentVersion();
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
