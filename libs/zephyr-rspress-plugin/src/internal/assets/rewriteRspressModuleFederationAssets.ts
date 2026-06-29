import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ZeErrors, ZephyrError } from 'zephyr-agent';

type ManifestEntry = {
  name?: string;
  path?: string;
  type?: string;
};

type ModuleFederationManifest = {
  metaData?: {
    publicPath?: string;
    ssrPublicPath?: string;
    remoteEntry?: ManifestEntry;
    ssrRemoteEntry?: ManifestEntry;
  };
};

const BROWSER_MANIFEST = 'mf-manifest.json';

export async function rewriteRspressModuleFederationAssets(
  outDir: string,
  files: string[]
): Promise<void> {
  const normalizedFiles = new Set(files.map(toPortablePath));

  if (!normalizedFiles.has(BROWSER_MANIFEST)) {
    return;
  }

  const browserManifest = await readManifest(outDir, BROWSER_MANIFEST);
  const ssgManifest = findSsgManifestFile(browserManifest, normalizedFiles);
  const ssgManifestData = ssgManifest ? await readManifest(outDir, ssgManifest) : null;
  const publicPaths = await collectManifestPublicPaths(
    outDir,
    normalizedFiles,
    ssgManifest
  );
  await rewriteHtmlAssetPrefixes(outDir, files, publicPaths);
  await writeManifest(
    outDir,
    BROWSER_MANIFEST,
    normalizeBrowserManifest(browserManifest, ssgManifest, ssgManifestData)
  );

  if (ssgManifest) {
    await rewriteManifest(outDir, ssgManifest, normalizeSsgManifest);
  }
}

async function collectManifestPublicPaths(
  outDir: string,
  files: Set<string>,
  ssgManifest: string | null
): Promise<string[]> {
  const publicPaths = new Set<string>();

  for (const file of [BROWSER_MANIFEST, ssgManifest].filter((value): value is string =>
    Boolean(value)
  )) {
    if (!files.has(file)) {
      continue;
    }

    const manifest = await readManifest(outDir, file);

    for (const value of [
      manifest.metaData?.publicPath,
      manifest.metaData?.ssrPublicPath,
    ]) {
      const prefix = normalizeHttpPrefix(value);

      if (prefix) {
        publicPaths.add(prefix);
      }
    }
  }

  return [...publicPaths].sort((a, b) => b.length - a.length);
}

async function rewriteHtmlAssetPrefixes(
  outDir: string,
  files: string[],
  publicPaths: string[]
): Promise<void> {
  await Promise.all(
    files
      .filter((file) => toPortablePath(file).endsWith('.html'))
      .map(async (file) => {
        const filePath = resolveOutputPath(outDir, file);
        let source = await readFile(filePath, 'utf8');
        const original = source;

        for (const publicPath of publicPaths) {
          source = rewriteHtmlAssetPrefix(source, publicPath);
        }
        source = rewriteAbsoluteRspressAssetUrls(source);

        if (source !== original) {
          await writeFile(filePath, source);
        }
      })
  );
}

async function rewriteManifest(
  outDir: string,
  file: string,
  normalize: (manifest: ModuleFederationManifest) => void
): Promise<void> {
  const manifest = await readManifest(outDir, file);
  normalize(manifest);
  await writeManifest(outDir, file, manifest);
}

async function writeManifest(
  outDir: string,
  file: string,
  manifest: ModuleFederationManifest
): Promise<void> {
  await writeFile(
    resolveOutputPath(outDir, file),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}

async function readManifest(
  outDir: string,
  file: string
): Promise<ModuleFederationManifest> {
  return JSON.parse(await readFile(resolveOutputPath(outDir, file), 'utf8'));
}

function normalizeBrowserManifest(
  manifest: ModuleFederationManifest,
  ssgManifest: string | null,
  ssgManifestData: ModuleFederationManifest | null
): ModuleFederationManifest {
  if (!manifest.metaData) {
    return manifest;
  }

  const ssrRemoteEntryPath = getSsrRemoteEntryPath(
    manifest,
    ssgManifest,
    ssgManifestData
  );
  manifest.metaData.publicPath = 'auto';
  delete manifest.metaData.ssrPublicPath;

  if (manifest.metaData.ssrRemoteEntry) {
    manifest.metaData.ssrRemoteEntry = {
      ...manifest.metaData.ssrRemoteEntry,
      path: ssrRemoteEntryPath,
    };
  }

  return manifest;
}

function normalizeSsgManifest(manifest: ModuleFederationManifest): void {
  if (!manifest.metaData) {
    return;
  }

  manifest.metaData.publicPath = 'auto';
  delete manifest.metaData.ssrPublicPath;
}

function normalizeHttpPrefix(value: string | undefined): string | null {
  if (!value || !/^https?:\/\//.test(value)) {
    return null;
  }

  return value.endsWith('/') ? value : `${value}/`;
}

function rewriteHtmlAssetPrefix(source: string, publicPath: string): string {
  return source.replace(createHtmlAssetUrl(publicPath), '$1/');
}

function rewriteAbsoluteRspressAssetUrls(source: string): string {
  return source.replace(createAbsoluteRspressAssetUrl(), '$1/');
}

function createHtmlAssetUrl(publicPath: string): RegExp {
  return new RegExp(`(\\b(?:href|src)\\s*=\\s*["'])${escapeRegExp(publicPath)}`, 'g');
}

function createAbsoluteRspressAssetUrl(): RegExp {
  return /(<(?:link|script)\b[^>]*\b(?:href|src)\s*=\s*["'])https?:\/\/[^"']+\/(?=static\/)/g;
}

function findSsgManifestFile(
  browserManifest: ModuleFederationManifest,
  files: Set<string>
): string | null {
  const candidates = [
    manifestFileFromPublicPath(browserManifest.metaData?.ssrPublicPath),
    manifestFileFromEntryPath(browserManifest.metaData?.ssrRemoteEntry?.path),
    ...[...files]
      .filter((file) => file !== BROWSER_MANIFEST && file.endsWith('/mf-manifest.json'))
      .sort(),
  ];

  return candidates.find((candidate) => candidate && files.has(candidate)) ?? null;
}

function getSsrRemoteEntryPath(
  manifest: ModuleFederationManifest,
  ssgManifest: string | null,
  ssgManifestData: ModuleFederationManifest | null
): string {
  const ssgManifestDir = manifestDir(ssgManifest);

  return (
    remoteEntryDir(ssgManifestData?.metaData?.remoteEntry, ssgManifestDir) ??
    ssgManifestDir ??
    normalizeManifestDir(manifest.metaData?.ssrRemoteEntry?.path) ??
    pathFromPublicPath(manifest.metaData?.ssrPublicPath) ??
    'mf-ssg/'
  );
}

function manifestFileFromPublicPath(value: string | undefined): string | null {
  const dir = pathFromPublicPath(value);
  return dir ? `${dir}mf-manifest.json` : null;
}

function manifestFileFromEntryPath(value: string | undefined): string | null {
  const dir = normalizeManifestDir(value);
  return dir ? `${dir}mf-manifest.json` : null;
}

function remoteEntryDir(
  entry: ManifestEntry | undefined,
  baseDir: string | null
): string | null {
  if (!entry) {
    return null;
  }

  return normalizeManifestDir(
    `${baseDir ?? ''}${normalizeManifestDir(entry.path) ?? ''}`
  );
}

function pathFromPublicPath(value: string | undefined): string | null {
  if (!value || !/^https?:\/\//.test(value)) {
    return null;
  }

  try {
    return normalizeManifestDir(new URL(value).pathname);
  } catch {
    return null;
  }
}

function manifestDir(file: string | null): string | null {
  if (!file || !file.includes('/')) {
    return null;
  }

  return normalizeManifestDir(file.slice(0, file.lastIndexOf('/') + 1));
}

function normalizeManifestDir(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = toPortablePath(value).replace(/^\/+/, '');

  if (!normalized || normalized === '.') {
    return null;
  }

  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveOutputPath(outDir: string, file: string): string {
  const root = path.resolve(outDir);
  const resolved = path.resolve(root, file);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `Invalid output file path: ${file}`,
    });
  }

  return resolved;
}

function toPortablePath(file: string): string {
  return file.split(path.sep).join('/');
}
