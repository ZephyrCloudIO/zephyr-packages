/**
 * Snapshot asset paths are protocol values, not filesystem paths. Keep their canonical
 * form portable across bundlers and prevent a contribution from escaping the snapshot
 * root.
 */
export function normalizeSnapshotAssetPath(assetPath: string): string {
  const normalized = assetPath.replaceAll('\\', '/');
  if (
    !normalized ||
    normalized.includes('\0') ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized) ||
    /^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(normalized)
  ) {
    throw new Error(`Asset path must be a relative snapshot path: "${assetPath}"`);
  }

  const segments = normalized.split('/').filter((segment) => segment && segment !== '.');
  if (segments.length === 0 || segments.includes('..')) {
    throw new Error(`Asset path must not escape the snapshot root: "${assetPath}"`);
  }
  return segments.join('/');
}
