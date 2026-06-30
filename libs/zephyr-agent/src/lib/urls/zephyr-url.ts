export const ZEPHYR_MANIFEST_FILENAME = 'zephyr-manifest.json';

export function stripFederatedRemoteName(remoteUrl: string): string {
  const remoteNameSeparator = remoteUrl.indexOf('@');
  if (remoteNameSeparator === -1) {
    return remoteUrl;
  }

  return remoteUrl.slice(remoteNameSeparator + 1);
}

function normalizeSiblingPath(path: string): string {
  return path.replace(/^\.?\/+/, '');
}

function hasFileLikeLastSegment(url: URL): boolean {
  const segments = url.pathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  return !!lastSegment && lastSegment.includes('.');
}

export function getPathPreservingBaseUrl(referenceUrl: string): string {
  const url = new URL(stripFederatedRemoteName(referenceUrl));
  url.search = '';
  url.hash = '';

  if (hasFileLikeLastSegment(url)) {
    url.pathname = url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1);
  } else if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }

  return url.toString().replace(/\/$/, '');
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
