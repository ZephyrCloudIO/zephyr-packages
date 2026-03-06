import { brightRedBgName } from '../logging/debug';

const ZEPHYR_AGENT_WARNING_HEADER = 'x-zephyr-agent-warning';
const ZEPHYR_AGENT_CURRENT_VERSION_HEADER = 'x-zephyr-agent-current-version';
const ZEPHYR_AGENT_LATEST_VERSION_HEADER = 'x-zephyr-agent-latest-version';
const OUTDATED_CLIENT_WARNING = 'outdated_client';

const notifiedVersionPairs = new Set<string>();

type HeaderBag = Headers | Record<string, unknown> | undefined | null;

function readHeader(headers: HeaderBag, key: string): string | undefined {
  if (!headers) {
    return undefined;
  }

  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    return headers.get(key) ?? undefined;
  }

  for (const [headerKey, headerValue] of Object.entries(headers)) {
    if (headerKey.toLowerCase() !== key) {
      continue;
    }

    if (typeof headerValue === 'string') {
      return headerValue;
    }

    if (Array.isArray(headerValue)) {
      return headerValue.find((value) => typeof value === 'string');
    }
  }

  return undefined;
}

export function maybeShowOutdatedVersionWarning(headers: HeaderBag): void {
  const warning = readHeader(headers, ZEPHYR_AGENT_WARNING_HEADER);
  if (warning?.toLowerCase() !== OUTDATED_CLIENT_WARNING) {
    return;
  }

  const currentVersion =
    readHeader(headers, ZEPHYR_AGENT_CURRENT_VERSION_HEADER) ?? 'unknown';
  const latestVersion =
    readHeader(headers, ZEPHYR_AGENT_LATEST_VERSION_HEADER) ?? 'unknown';

  const versionPair = `${currentVersion}=>${latestVersion}`;
  if (notifiedVersionPairs.has(versionPair)) {
    return;
  }

  notifiedVersionPairs.add(versionPair);

  const message = [
    `${brightRedBgName}  Your zephyr-packages version is outdated (current: ${currentVersion}, latest: ${latestVersion}).`,
    `${brightRedBgName}  Older versions can cause unexpected build and deployment issues.`,
    `${brightRedBgName}  If you are facing any issue, upgrade {package name} first.`,
  ].join('\n');

  console.error(message);
}
