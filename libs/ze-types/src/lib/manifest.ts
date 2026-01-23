import { ZEPHYR_MANIFEST_FILENAME, type ZephyrManifest } from 'zephyr-edge-contract';

export function resolveZephyrManifestUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('ze-types: empty Zephyr URL');
  }
  if (trimmed.endsWith(`/${ZEPHYR_MANIFEST_FILENAME}`)) {
    return trimmed;
  }
  if (trimmed.endsWith(ZEPHYR_MANIFEST_FILENAME)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    url.search = '';
    url.hash = '';
    if (!url.pathname.endsWith('/')) {
      url.pathname += '/';
    }
    url.pathname += ZEPHYR_MANIFEST_FILENAME;
    return url.toString();
  } catch {
    return `${trimmed.replace(/\/+$/, '')}/${ZEPHYR_MANIFEST_FILENAME}`;
  }
}

export async function fetchZephyrManifest(manifestUrl: string): Promise<ZephyrManifest> {
  let response: Response;
  try {
    response = await fetch(manifestUrl, {
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (cause) {
    const error = new Error(`ze-types: failed to fetch ${manifestUrl}`);
    (error as { cause?: unknown }).cause = cause;
    throw error;
  }

  if (!response.ok) {
    throw new Error(
      `ze-types: failed to fetch ${manifestUrl} (${response.status} ${response.statusText})`
    );
  }

  const data = (await response.json()) as unknown;
  if (!isZephyrManifest(data)) {
    throw new Error(`ze-types: invalid manifest from ${manifestUrl}`);
  }

  return data;
}

function isZephyrManifest(value: unknown): value is ZephyrManifest {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const deps = (value as { dependencies?: unknown }).dependencies;
  if (!deps || typeof deps !== 'object' || Array.isArray(deps)) {
    return false;
  }
  return true;
}
