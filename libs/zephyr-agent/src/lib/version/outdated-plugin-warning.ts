import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { safe_json_parse } from 'zephyr-edge-contract';
import { fetchWithRetries } from '../http/fetch-with-retries';
import { brightYellowBgName } from '../logging/debug';
import { getZephyrAgentVersion } from './zephyr-agent-version';

const warnedVersionPairs = new Set<string>();
const NPM_FETCH_TIMEOUT_MS = 1_500;
const requireFromHere = createRequire(__filename);

type VersionChannel = 'stable' | 'canary' | 'next';

type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  channel: VersionChannel;
  prereleaseNumber: number | null;
};

type DistTagsResponse = {
  latest?: unknown;
  canary?: unknown;
  next?: unknown;
};

type ComparisonTarget = {
  label: string;
  version: string;
};

function parseVersion(version: string): ParsedVersion | null {
  const sanitized = version.trim().replace(/^v/i, '');
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-(canary|next)\.(\d+))?$/.exec(
    sanitized
  );

  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    channel: (match[4] as VersionChannel | undefined) ?? 'stable',
    prereleaseNumber: match[5] ? Number(match[5]) : null,
  };
}

function isOlderVersion(
  currentVersion: string,
  latestVersion: string
): boolean {
  const current = parseVersion(currentVersion);
  const latest = parseVersion(latestVersion);

  if (!current || !latest) {
    return false;
  }

  if (current.major !== latest.major) {
    return current.major < latest.major;
  }

  if (current.minor !== latest.minor) {
    return current.minor < latest.minor;
  }

  if (current.patch !== latest.patch) {
    return current.patch < latest.patch;
  }

  if (current.channel !== latest.channel) {
    return false;
  }

  if (current.channel === 'stable') {
    return false;
  }

  if (current.prereleaseNumber === null || latest.prereleaseNumber === null) {
    return false;
  }

  return current.prereleaseNumber < latest.prereleaseNumber;
}

function getComparisonTarget(
  currentVersion: string,
  distTags: DistTagsResponse
): ComparisonTarget | null {
  const parsedCurrentVersion = parseVersion(currentVersion);

  if (!parsedCurrentVersion) {
    return null;
  }

  if (parsedCurrentVersion.channel === 'canary') {
    return typeof distTags.canary === 'string'
      ? { label: 'latest canary', version: distTags.canary }
      : null;
  }

  if (parsedCurrentVersion.channel === 'next') {
    return typeof distTags.next === 'string'
      ? { label: 'latest next', version: distTags.next }
      : null;
  }

  return typeof distTags.latest === 'string'
    ? { label: 'latest', version: distTags.latest }
    : null;
}

async function fetchDistTags(
  packageName: string
): Promise<DistTagsResponse | null> {
  const npmDistTagsUrl = new URL(
    `https://registry.npmjs.org/-/package/${encodeURIComponent(packageName)}/dist-tags`
  );
  const abortController = new AbortController();
  const timeoutId = setTimeout(
    () => abortController.abort(),
    NPM_FETCH_TIMEOUT_MS
  );

  try {
    const response = await fetchWithRetries(
      npmDistTagsUrl,
      { signal: abortController.signal },
      2
    );
    return (await response.json()) as DistTagsResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function resolveInstalledPluginVersion(pluginPackageName: string): string {
  try {
    const packageJsonPath = requireFromHere.resolve(
      `${pluginPackageName}/package.json`,
      {
        paths: [process.cwd()],
      }
    );
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
  const distTags = await fetchDistTags(pluginPackageName);

  if (!distTags) {
    return;
  }

  const comparisonTarget = getComparisonTarget(currentVersion, distTags);

  if (!comparisonTarget) {
    return;
  }

  if (!isOlderVersion(currentVersion, comparisonTarget.version)) {
    return;
  }

  const versionPair = `${pluginPackageName}:${currentVersion}->${comparisonTarget.version}`;
  if (warnedVersionPairs.has(versionPair)) {
    return;
  }
  warnedVersionPairs.add(versionPair);

  const message = [
    `${brightYellowBgName}  Your Zephyr Plugin version is outdated (current: ${currentVersion}, ${comparisonTarget.label}: ${comparisonTarget.version}).`,
    `${brightYellowBgName}  Older versions can cause unexpected build and deployment issues.`,
    `${brightYellowBgName}  If you are facing any issue, upgrade ${pluginPackageName} first.`,
  ].join('\n');

  console.error(message);
}

export function resetOutdatedPluginWarningStateForTests(): void {
  warnedVersionPairs.clear();
}
