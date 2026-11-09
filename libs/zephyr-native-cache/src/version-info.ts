import type { ZephyrVersionInfo } from './types';

const VERSION_INFO_PATH = '/__get_version_info__';
const VERSION_INFO_TIMEOUT_MS = 5_000;

// Parsed by hand: React Native's URL polyfill doesn't implement the setters.
const ABSOLUTE_URL = /^([a-z][a-z0-9+.-]*:)\/\/([^/?#]+)(.*)$/i;

/**
 * Ask the Zephyr edge which version a bundle URL's host currently serves. Returns
 * undefined when the host isn't a Zephyr deployment (e.g. a local dev server) or the
 * request fails.
 */
export async function fetchVersionInfo(
  bundleUrl: string
): Promise<ZephyrVersionInfo | undefined> {
  const match = ABSOLUTE_URL.exec(bundleUrl);
  if (!match) return undefined;
  const [, protocol, host] = match;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERSION_INFO_TIMEOUT_MS);
  try {
    const response = await fetch(`${protocol}//${host}${VERSION_INFO_PATH}`, {
      signal: controller.signal,
    });
    if (!response.ok) return undefined;
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object') return undefined;
    const { snapshot_id, version_url, published_at } = body as Record<string, unknown>;
    if (typeof snapshot_id !== 'string' || typeof version_url !== 'string') {
      return undefined;
    }
    return {
      snapshotId: snapshot_id,
      versionUrl: version_url,
      publishedAt: typeof published_at === 'number' ? published_at : undefined,
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The same bundle on the immutable version host. The edge reports `version_url` without a
 * scheme; the bundle URL's scheme is reused.
 */
export function toVersionedBundleUrl(
  bundleUrl: string,
  versionUrl: string
): string | undefined {
  const bundle = ABSOLUTE_URL.exec(bundleUrl);
  if (!bundle) return undefined;
  const [, protocol, , rest] = bundle;
  const version = ABSOLUTE_URL.exec(versionUrl);
  if (version) return `${version[1]}//${version[2]}${rest}`;
  const versionHost = versionUrl.replace(/\/+$/, '');
  if (!versionHost || /[/?#]/.test(versionHost)) return undefined;
  return `${protocol}//${versionHost}${rest}`;
}
