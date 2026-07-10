const VOLATILE_QUERY_KEYS = new Set(['_', 'cachebust', 'cachebuster', 't', 'timestamp']);

/**
 * Canonical identity for bundle bytes. Metro query flags are content-sensitive and must
 * be retained; only known cache-busting keys are discarded. Sorting makes callers with
 * different parameter order converge on the same cache entry.
 */
export function getBundleCacheKey(bundleUrl: string): string {
  const withoutHash = bundleUrl.split('#', 1)[0] ?? bundleUrl;
  const queryIndex = withoutHash.indexOf('?');
  if (queryIndex < 0) {
    return withoutHash;
  }

  const base = withoutHash.slice(0, queryIndex);
  const params = [...new URLSearchParams(withoutHash.slice(queryIndex + 1)).entries()]
    .filter(([key]) => !VOLATILE_QUERY_KEYS.has(key.toLowerCase()))
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey
        ? leftValue.localeCompare(rightValue)
        : leftKey.localeCompare(rightKey)
    );
  const normalized = new URLSearchParams(params).toString();
  return normalized ? `${base}?${normalized}` : base;
}

/** Short deterministic suffix used to keep content variants in separate files. */
export function getBundleCacheVariant(bundleUrl: string): string | undefined {
  const key = getBundleCacheKey(bundleUrl);
  const queryIndex = key.indexOf('?');
  if (queryIndex < 0) {
    return undefined;
  }

  let hash = 0x811c9dc5;
  const query = key.slice(queryIndex + 1);
  for (let index = 0; index < query.length; index += 1) {
    hash ^= query.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
