export { ZEPHYR_MANIFEST_FILENAME } from 'zephyr-edge-contract';
import { ZEPHYR_MANIFEST_FILENAME } from 'zephyr-edge-contract';

/** Reserved route base for path-addressed deployments: `/__zephyr/v1/{v|t|e}/<route-key>`. */
const ZEPHYR_ROUTE_BASE_REGEX = /^\/__zephyr\/v1\/[vte]\/[^/]+/;

export function stripFederatedRemoteName(remoteUrl: string): string {
  const remoteNameSeparator = remoteUrl.indexOf('@');
  if (remoteNameSeparator === -1) {
    return remoteUrl;
  }

  const candidate = remoteUrl.slice(remoteNameSeparator + 1);
  // A `@` can also appear inside the URL path itself (e.g. /@scope/remoteEntry.js),
  // so only strip when the remainder is an absolute URL.
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(candidate) ? candidate : remoteUrl;
}

function normalizeSiblingPath(path: string): string {
  return path.replace(/^\.?\/+/, '');
}

/**
 * Returns the deployment root for a Zephyr-served URL. Zephyr emits
 * `zephyr-manifest.json` and `mf-manifest.json` at the deployment root, so sibling
 * derivation must not depend on how deeply the reference file is nested (e.g. rsbuild
 * entry chunks under `static/js/`).
 *
 * - Path mode (`/__zephyr/v1/{v|t|e}/<route-key>/...`): the route base.
 * - Hostname mode: the origin.
 */
export function getPathPreservingBaseUrl(referenceUrl: string): string {
  const url = new URL(stripFederatedRemoteName(referenceUrl));
  const routeBase = ZEPHYR_ROUTE_BASE_REGEX.exec(url.pathname);

  return routeBase ? `${url.origin}${routeBase[0]}` : url.origin;
}

export function appendZephyrUrlPath(baseUrl: string, path: string): string {
  const relativePath = normalizeSiblingPath(path);
  if (!relativePath) {
    return baseUrl;
  }

  return new URL(
    relativePath,
    baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  ).toString();
}

export function resolveZephyrSiblingUrl(
  referenceUrl: string,
  siblingPath = ZEPHYR_MANIFEST_FILENAME
): string {
  const baseUrl = getPathPreservingBaseUrl(referenceUrl);

  return appendZephyrUrlPath(baseUrl, siblingPath);
}
