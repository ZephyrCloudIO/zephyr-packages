// Mirrors @module-federation/sdk `getManifestFileName` so Zephyr resolves the
// MF2 manifest path the same way MF does, without pulling in the SDK.
// Source: mf-core/packages/sdk/src/generateSnapshotFromManifest.ts

export type MfManifestConfig =
  | boolean
  | { fileName?: string; filePath?: string }
  | undefined;

const DEFAULT_MANIFEST_FILENAME = 'mf-manifest.json';
const JSON_EXT = '.json';

export function resolveMfManifestPath(manifest: MfManifestConfig): string | undefined {
  if (manifest === false) return undefined;

  const filePath = typeof manifest === 'object' ? (manifest?.filePath ?? '') : '';
  const fileName = typeof manifest === 'object' ? (manifest?.fileName ?? '') : '';

  const resolvedFileName = fileName ? ensureJsonExt(fileName) : DEFAULT_MANIFEST_FILENAME;
  return simpleJoin(filePath, resolvedFileName);
}

function ensureJsonExt(name: string): string {
  return name.endsWith(JSON_EXT) ? name : `${name}${JSON_EXT}`;
}

function simpleJoin(dir: string, name: string): string {
  if (!dir) return name;
  const normalized = normalizeDir(dir);
  if (!normalized) return name;
  return normalized.endsWith('/') ? `${normalized}${name}` : `${normalized}/${name}`;
}

function normalizeDir(dir: string): string {
  if (dir === '.') return '';
  if (dir.startsWith('./')) return dir.slice(2);
  if (dir.startsWith('/')) {
    const stripped = dir.slice(1);
    return stripped.endsWith('/') ? stripped.slice(0, -1) : stripped;
  }
  return dir;
}
