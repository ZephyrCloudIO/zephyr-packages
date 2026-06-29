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
const GLOBAL_REMOTE_ENTRY_PUBLIC_PATH_RUNTIME =
  '__webpack_require__.p=(()=>{var e;if(typeof document!="undefined"){var t=document.currentScript;if(t&&t.tagName==="SCRIPT")e=t.src;if(!e){var r=document.getElementsByTagName("script");if(r.length)e=r[r.length-1].src}}if(!e&&typeof location!="undefined")e=location.href;if(!e)return "/";return e.replace(/#.*$/,"").replace(/\\?.*$/,"").replace(/\\/[^\\/]*$/,"/")})()';
const MODULE_REMOTE_ENTRY_PUBLIC_PATH_RUNTIME =
  '__webpack_require__.p=new URL("./",import.meta.url).href';

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
  const publicPaths = await collectManifestPublicPaths(
    outDir,
    normalizedFiles,
    ssgManifest
  );
  await rewriteHtmlAssetPrefixes(outDir, files, publicPaths);
  await rewriteJsPublicPaths(
    outDir,
    files,
    publicPaths,
    getRemoteEntryPublicPathRuntime(browserManifest)
  );
  await writeManifest(
    outDir,
    BROWSER_MANIFEST,
    normalizeBrowserManifest(browserManifest, ssgManifest)
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
  if (publicPaths.length === 0) {
    return;
  }

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

        if (source !== original) {
          await writeFile(filePath, source);
        }
      })
  );
}

async function rewriteJsPublicPaths(
  outDir: string,
  files: string[],
  publicPaths: string[],
  remoteEntryPublicPathRuntime: string
): Promise<void> {
  if (publicPaths.length === 0) {
    return;
  }

  await Promise.all(
    files
      .filter((file) => toPortablePath(file).endsWith('.js'))
      .map(async (file) => {
        const normalizedFile = toPortablePath(file);
        const filePath = resolveOutputPath(outDir, file);
        let source = await readFile(filePath, 'utf8');
        const original = source;
        const replacement =
          normalizedFile === 'remoteEntry.js'
            ? remoteEntryPublicPathRuntime
            : '__webpack_require__.p="/"';

        for (const publicPath of publicPaths) {
          source = source.replace(createPublicPathAssignment(publicPath), replacement);
        }

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
  ssgManifest: string | null
): ModuleFederationManifest {
  if (!manifest.metaData) {
    return manifest;
  }

  const ssrRemoteEntryPath = getSsrRemoteEntryPath(manifest, ssgManifest);
  manifest.metaData.publicPath = 'auto';
  delete manifest.metaData.ssrPublicPath;

  if (manifest.metaData.ssrRemoteEntry) {
    manifest.metaData.ssrRemoteEntry = {
      ...manifest.metaData.ssrRemoteEntry,
      path: ssrRemoteEntryPath,
      type: 'commonjs-module',
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

  if (manifest.metaData.remoteEntry) {
    manifest.metaData.remoteEntry = {
      ...manifest.metaData.remoteEntry,
      type: 'commonjs-module',
    };
  }
}

function normalizeHttpPrefix(value: string | undefined): string | null {
  if (!value || !/^https?:\/\//.test(value)) {
    return null;
  }

  return value.endsWith('/') ? value : `${value}/`;
}

function getRemoteEntryPublicPathRuntime(manifest: ModuleFederationManifest): string {
  return manifest.metaData?.remoteEntry?.type === 'module'
    ? MODULE_REMOTE_ENTRY_PUBLIC_PATH_RUNTIME
    : GLOBAL_REMOTE_ENTRY_PUBLIC_PATH_RUNTIME;
}

function rewriteHtmlAssetPrefix(source: string, publicPath: string): string {
  return source.replace(createHtmlAssetUrl(publicPath), '$1/');
}

function createHtmlAssetUrl(publicPath: string): RegExp {
  return new RegExp(`(\\b(?:href|src)\\s*=\\s*["'])${escapeRegExp(publicPath)}`, 'g');
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
  ssgManifest: string | null
): string {
  return (
    normalizeManifestDir(manifest.metaData?.ssrRemoteEntry?.path) ??
    pathFromPublicPath(manifest.metaData?.ssrPublicPath) ??
    manifestDir(ssgManifest) ??
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

function createPublicPathAssignment(publicPath: string): RegExp {
  return new RegExp(
    `__webpack_require__\\.p\\s*=\\s*${escapeRegExp(JSON.stringify(publicPath))}`,
    'g'
  );
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
