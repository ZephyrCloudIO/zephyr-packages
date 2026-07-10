import { readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ZeErrors, ZephyrError } from 'zephyr-agent';
import { forEachLimit } from 'zephyr-edge-contract';

type ManifestEntry = {
  name?: string;
  path?: string;
  type?: string;
};

type ModuleFederationManifest = {
  metaData?: {
    publicPath?: string;
    getPublicPath?: string;
    ssrPublicPath?: string;
    remoteEntry?: ManifestEntry;
    ssrRemoteEntry?: ManifestEntry;
  };
};

const BROWSER_MANIFEST = 'mf-manifest.json';
const MAX_HTML_REWRITE_CONCURRENCY = 16;
const HTML_ASSET_ATTRIBUTE =
  /(<(?:link|script)\b[^>]*?\b(?:href|src)\s*=\s*["'])(https?:\/\/[^"']+)(["'])/gi;

export async function rewriteRspressModuleFederationAssets(
  outDir: string,
  files: string[]
): Promise<void> {
  const normalizedFiles = new Set(files.map(toPortablePath));
  if (!normalizedFiles.has(BROWSER_MANIFEST)) {
    return;
  }

  const browserManifest = await readManifest(outDir, BROWSER_MANIFEST);
  const nestedManifestFiles = [...normalizedFiles]
    .filter((file) => file !== BROWSER_MANIFEST && file.endsWith('/mf-manifest.json'))
    .sort();
  const nestedManifests = new Map<string, ModuleFederationManifest>();
  for (const file of nestedManifestFiles) {
    nestedManifests.set(file, await readManifest(outDir, file));
  }
  const ssgManifest = selectSsgManifest(
    browserManifest,
    normalizedFiles,
    nestedManifests
  );
  const ssgManifestData = ssgManifest ? (nestedManifests.get(ssgManifest) ?? null) : null;
  const publicPaths = collectManifestPublicPaths(browserManifest, ssgManifestData);

  await rewriteHtmlAssetPrefixes(outDir, files, normalizedFiles, publicPaths);
  normalizeBrowserManifest(browserManifest, ssgManifest, ssgManifestData);
  await writeManifest(outDir, BROWSER_MANIFEST, browserManifest);

  if (ssgManifest && ssgManifestData) {
    normalizeSsgManifest(ssgManifestData);
    await writeManifest(outDir, ssgManifest, ssgManifestData);
  }
}

function collectManifestPublicPaths(
  browserManifest: ModuleFederationManifest,
  ssgManifest: ModuleFederationManifest | null
): string[] {
  const publicPaths = new Set<string>();
  for (const manifest of [browserManifest, ssgManifest]) {
    for (const value of [
      manifest?.metaData?.publicPath,
      manifest?.metaData?.ssrPublicPath,
    ]) {
      const prefix = normalizeHttpPrefix(value);
      if (prefix) publicPaths.add(prefix);
    }
  }
  return [...publicPaths].sort((left, right) => right.length - left.length);
}

async function rewriteHtmlAssetPrefixes(
  outDir: string,
  files: string[],
  emittedFiles: Set<string>,
  publicPaths: string[]
): Promise<void> {
  await forEachLimit(
    files
      .filter((file) => toPortablePath(file).endsWith('.html'))
      .map((file) => async () => {
        const portableFile = toPortablePath(file);
        const filePath = await resolveOutputFile(outDir, file);
        const source = await readFile(filePath, 'utf8');
        const rewritten = source.replace(
          HTML_ASSET_ATTRIBUTE,
          (match, prefix: string, absoluteUrl: string, quote: string) => {
            const asset = resolveEmittedAsset(absoluteUrl, publicPaths, emittedFiles);
            if (!asset) return match;
            return `${prefix}${relativeAssetUrl(portableFile, asset)}${quote}`;
          }
        );
        if (rewritten !== source) {
          await writeFile(filePath, rewritten);
        }
      }),
    MAX_HTML_REWRITE_CONCURRENCY
  );
}

function resolveEmittedAsset(
  absoluteUrl: string,
  publicPaths: string[],
  emittedFiles: Set<string>
): string | null {
  const matchedPrefix = publicPaths.find((prefix) => absoluteUrl.startsWith(prefix));
  if (matchedPrefix) {
    const candidate = absoluteUrl.slice(matchedPrefix.length);
    if (emittedFiles.has(stripQueryAndHash(candidate))) return candidate;
  }

  let url: URL;
  try {
    url = new URL(absoluteUrl);
  } catch {
    return null;
  }
  const pathname = url.pathname.replace(/^\/+/, '');
  const candidates = [pathname];
  const staticIndex = pathname.lastIndexOf('static/');
  if (staticIndex > 0) candidates.push(pathname.slice(staticIndex));

  const emitted = candidates.find((candidate) => emittedFiles.has(candidate));
  return emitted ? `${emitted}${url.search}${url.hash}` : null;
}

function relativeAssetUrl(htmlFile: string, asset: string): string {
  const cleanAsset = stripQueryAndHash(asset);
  const suffix = asset.slice(cleanAsset.length);
  const htmlDirectory = path.posix.dirname(htmlFile);
  const relative = path.posix.relative(
    htmlDirectory === '.' ? '' : htmlDirectory,
    cleanAsset
  );
  const prefixed = relative.startsWith('.') ? relative : `./${relative}`;
  return `${prefixed}${suffix}`;
}

function normalizeBrowserManifest(
  manifest: ModuleFederationManifest,
  ssgManifest: string | null,
  ssgManifestData: ModuleFederationManifest | null
): void {
  if (!manifest.metaData) return;

  setAutoPublicPathUnlessExplicit(manifest);
  delete manifest.metaData.ssrPublicPath;

  if (manifest.metaData.ssrRemoteEntry && ssgManifest) {
    manifest.metaData.ssrRemoteEntry = {
      ...manifest.metaData.ssrRemoteEntry,
      path: getSsrRemoteEntryPath(ssgManifest, ssgManifestData),
    };
  }
}

function normalizeSsgManifest(manifest: ModuleFederationManifest): void {
  if (!manifest.metaData) return;
  setAutoPublicPathUnlessExplicit(manifest);
  delete manifest.metaData.ssrPublicPath;
}

function setAutoPublicPathUnlessExplicit(manifest: ModuleFederationManifest): void {
  const metadata = manifest.metaData;
  if (!metadata) return;
  // Module Federation gives getPublicPath semantic precedence only when publicPath is
  // absent. Do not add publicPath and silently shadow an explicit user callback.
  if (
    metadata.getPublicPath &&
    !Object.prototype.hasOwnProperty.call(metadata, 'publicPath')
  ) {
    return;
  }
  metadata.publicPath = 'auto';
}

function selectSsgManifest(
  browserManifest: ModuleFederationManifest,
  files: Set<string>,
  nestedManifests: Map<string, ModuleFederationManifest>
): string | null {
  const directCandidates = [
    manifestFileFromPublicPath(browserManifest.metaData?.ssrPublicPath),
    manifestFileFromEntryPath(browserManifest.metaData?.ssrRemoteEntry?.path),
  ].filter((candidate): candidate is string =>
    Boolean(candidate && files.has(candidate))
  );
  const uniqueDirect = [...new Set(directCandidates)];
  if (uniqueDirect.length === 1) return uniqueDirect[0] ?? null;
  if (uniqueDirect.length > 1) {
    throw ambiguousSsgManifest(uniqueDirect);
  }

  const discovered = [...nestedManifests.keys()];
  if (discovered.length <= 1) return discovered[0] ?? null;

  const expectedName = browserManifest.metaData?.ssrRemoteEntry?.name;
  const matching = expectedName
    ? discovered.filter(
        (file) => nestedManifests.get(file)?.metaData?.remoteEntry?.name === expectedName
      )
    : [];
  if (matching.length === 1) return matching[0] ?? null;
  throw ambiguousSsgManifest(matching.length > 1 ? matching : discovered);
}

function ambiguousSsgManifest(candidates: string[]): Error {
  return new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
    message: `Rspress emitted ambiguous Module Federation SSG manifests: ${candidates.join(', ')}`,
  });
}

function getSsrRemoteEntryPath(
  ssgManifest: string,
  ssgManifestData: ModuleFederationManifest | null
): string {
  const manifestDirectory = manifestDir(ssgManifest) ?? '';
  const entryDirectory = normalizeManifestDir(
    ssgManifestData?.metaData?.remoteEntry?.path
  );
  return normalizeManifestDir(`${manifestDirectory}${entryDirectory ?? ''}`) ?? '';
}

function normalizeHttpPrefix(value: string | undefined): string | null {
  if (!value || !/^https?:\/\//i.test(value)) return null;
  return value.endsWith('/') ? value : `${value}/`;
}

function manifestFileFromPublicPath(value: string | undefined): string | null {
  if (!value || !/^https?:\/\//i.test(value)) return null;
  try {
    const directory = normalizeManifestDir(new URL(value).pathname);
    return directory ? `${directory}mf-manifest.json` : null;
  } catch {
    return null;
  }
}

function manifestFileFromEntryPath(value: string | undefined): string | null {
  const directory = normalizeManifestDir(value);
  return directory ? `${directory}mf-manifest.json` : null;
}

function manifestDir(file: string): string | null {
  const index = file.lastIndexOf('/');
  return index < 0 ? null : normalizeManifestDir(file.slice(0, index + 1));
}

function normalizeManifestDir(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = toPortablePath(value).replace(/^\/+/, '');
  const segments = normalized.split('/').filter((segment) => segment && segment !== '.');
  if (segments.length === 0 || segments.includes('..')) return null;
  return `${segments.join('/')}/`;
}

function stripQueryAndHash(value: string): string {
  return value.replace(/[?#].*$/, '');
}

async function readManifest(
  outDir: string,
  file: string
): Promise<ModuleFederationManifest> {
  return JSON.parse(await readFile(await resolveOutputFile(outDir, file), 'utf8'));
}

async function writeManifest(
  outDir: string,
  file: string,
  manifest: ModuleFederationManifest
): Promise<void> {
  await writeFile(
    await resolveOutputFile(outDir, file),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}

async function resolveOutputFile(outDir: string, file: string): Promise<string> {
  const root = path.resolve(outDir);
  const resolved = path.resolve(root, file);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw invalidOutputPath(file);
  }

  const [realRoot, realFile] = await Promise.all([realpath(root), realpath(resolved)]);
  if (realFile !== realRoot && !realFile.startsWith(`${realRoot}${path.sep}`)) {
    throw invalidOutputPath(file);
  }
  return resolved;
}

function invalidOutputPath(file: string): Error {
  return new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
    message: `Invalid Rspress output file path: ${file}`,
  });
}

function toPortablePath(file: string): string {
  return file.replace(/\\/g, '/');
}
