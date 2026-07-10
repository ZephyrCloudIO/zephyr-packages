import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { ZeErrors, ZephyrError } from 'zephyr-agent';

export interface VinextBuildAsset {
  content: Buffer;
  type: string;
}

export interface RscEnvironmentBuildConfigLike {
  outDir?: string;
}

export interface RscEnvironmentConfigLike {
  build?: RscEnvironmentBuildConfigLike;
}

export interface RscPluginManagerLike {
  buildAssetsManifest?: unknown;
  config?: {
    environments?: Record<string, RscEnvironmentConfigLike | undefined>;
  };
}

interface OutputChunkLike {
  type: 'chunk';
  fileName: string;
  code: string;
}

interface OutputAssetLike {
  type: 'asset';
  fileName: string;
  source: string | Uint8Array;
}

export type OutputBundleLike = Record<string, OutputChunkLike | OutputAssetLike>;

const REDUNDANT_NODE_SIDE_EFFECT_IMPORT_RE =
  /^[\t ]*import\s+['"]node:(?:fs|path)['"];?[\t ]*(?:\r?\n|$)/gm;

const CONTENT_TYPES_BY_EXTENSION: Record<string, string> = {
  '.avif': 'image/avif',
  '.cjs': 'application/javascript',
  '.css': 'text/css',
  '.eot': 'application/vnd.ms-fontobject',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.map': 'application/json',
  '.mjs': 'application/javascript',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function getAssetType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

function getRelativeBundleDir(outputRootDir: string, bundleDir: string): string {
  return getRelativeDirFromRoot(outputRootDir, bundleDir);
}

function toBuffer(item: OutputChunkLike | OutputAssetLike): Buffer {
  if (item.type === 'chunk') {
    return Buffer.from(item.code, 'utf-8');
  }

  if (typeof item.source === 'string') {
    return Buffer.from(item.source, 'utf-8');
  }

  return Buffer.from(item.source);
}

export function normalizePathForSnapshot(filePath: string): string {
  return filePath.split(path.sep).join('/').replace(/\\/g, '/');
}

/**
 * Vinext can leave unused built-in side-effect imports in its Worker entry. Cloudflare
 * Workers does not provide these Node modules unless compatibility flags are enabled, and
 * the imports have no observable side effects.
 */
export function stripRedundantNodeSideEffectImports(code: string): string {
  return code.replace(REDUNDANT_NODE_SIDE_EFFECT_IMPORT_RE, '');
}

function workerEntrypointContent(snapshotPath: string, content: Buffer): Buffer {
  if (snapshotPath !== 'server/index.js') return content;
  return Buffer.from(
    stripRedundantNodeSideEffectImports(content.toString('utf8')),
    'utf8'
  );
}

export function normalizeEntrypoint(entrypoint: string): string {
  let normalized = normalizePathForSnapshot(entrypoint.trim());

  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }
  while (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }
  if (normalized.startsWith('dist/')) {
    normalized = normalized.slice('dist/'.length);
  }
  const segments = normalized.split('/').filter((segment) => segment && segment !== '.');
  if (!normalized || segments.length === 0 || segments.includes('..')) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: `Vinext entrypoint must be inside the output directory: "${entrypoint}".`,
    });
  }
  return segments.join('/');
}

export function collectAssetsFromBundle(
  assets: Record<string, VinextBuildAsset>,
  outputRootDir: string,
  bundleDir: string,
  bundle: OutputBundleLike
): void {
  const relativeDir = getRelativeBundleDir(outputRootDir, bundleDir);

  for (const item of Object.values(bundle)) {
    const normalizedFileName = normalizePathForSnapshot(item.fileName);
    const snapshotPath = relativeDir
      ? `${relativeDir}/${normalizedFileName}`
      : normalizedFileName;

    assets[snapshotPath] = {
      content: workerEntrypointContent(snapshotPath, toBuffer(item)),
      type: getAssetType(snapshotPath),
    };
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(rootDir: string): Promise<string[]> {
  const stack = [rootDir];
  const files: string[] = [];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) {
      continue;
    }

    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  return files;
}

function buildSnapshotPath(relativeDir: string, relativeFilePath: string): string {
  const normalizedRelativeFilePath = normalizePathForSnapshot(relativeFilePath);
  return relativeDir
    ? `${relativeDir}/${normalizedRelativeFilePath}`
    : normalizedRelativeFilePath;
}

export async function collectStaticClientAssets(
  assets: Record<string, VinextBuildAsset>,
  outputRootDir: string,
  clientOutDir: string | undefined
): Promise<void> {
  if (!clientOutDir) {
    return;
  }

  const relativeClientDir = getRelativeDirFromRoot(outputRootDir, clientOutDir);
  if (!relativeClientDir) {
    return;
  }

  if (!(await pathExists(clientOutDir))) {
    return;
  }

  const clientFiles = await walkFiles(clientOutDir);
  for (const clientFile of clientFiles) {
    const relativeClientPath = path.relative(clientOutDir, clientFile);
    const snapshotPath = buildSnapshotPath(relativeClientDir, relativeClientPath);
    if (assets[snapshotPath]) {
      continue;
    }

    assets[snapshotPath] = {
      content: await fs.readFile(clientFile),
      type: getAssetType(snapshotPath),
    };
  }
}

/** Collect the complete Vinext output after every Vite environment has finished. */
export async function collectOutputDirectoryAssets(
  assets: Record<string, VinextBuildAsset>,
  outputRootDir: string
): Promise<void> {
  if (!(await pathExists(outputRootDir))) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: `Vinext output directory does not exist: ${outputRootDir}`,
    });
  }

  for (const filePath of await walkFiles(outputRootDir)) {
    const snapshotPath = normalizePathForSnapshot(path.relative(outputRootDir, filePath));
    const content = await fs.readFile(filePath);
    assets[snapshotPath] = {
      content: workerEntrypointContent(snapshotPath, content),
      type: getAssetType(snapshotPath),
    };
  }
}

export function detectEntrypointFromAssets(
  assets: Record<string, VinextBuildAsset>
): string | undefined {
  const candidates = [
    'server/index.js',
    'server/index.mjs',
    'server/index.cjs',
    'ssr/index.js',
    'ssr/index.mjs',
    'ssr/index.cjs',
    'rsc/index.js',
    'rsc/index.mjs',
    'rsc/index.cjs',
  ];
  const preferred = candidates.find((candidate) => assets[candidate]);
  if (preferred) return preferred;

  const paths = new Set(Object.keys(assets));
  for (const assetPath of paths) {
    if (!/(^|\/)wrangler\.jsonc?$/.test(assetPath)) continue;
    const directory = path.posix.dirname(assetPath);
    for (const fileName of ['index.js', 'index.mjs', 'index.cjs']) {
      const candidate = directory === '.' ? fileName : `${directory}/${fileName}`;
      if (paths.has(candidate)) return candidate;
    }
  }
  return undefined;
}

function getRelativeDirFromRoot(outputRootDir: string, targetDir: string): string {
  const relativeDir = normalizePathForSnapshot(
    path.relative(path.resolve(outputRootDir), path.resolve(targetDir))
  );

  if (!relativeDir || relativeDir === '.') {
    return '';
  }

  if (
    relativeDir === '..' ||
    relativeDir.startsWith('../') ||
    path.posix.isAbsolute(relativeDir) ||
    /^[A-Za-z]:\//.test(relativeDir)
  ) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: `Vinext output path "${targetDir}" is outside output root "${outputRootDir}".`,
    });
  }

  return relativeDir;
}

function serializeBuildAssetsManifest(manifest: unknown): Buffer {
  return Buffer.from(`export default ${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
}

export function injectRscAssetsManifest(
  assets: Record<string, VinextBuildAsset>,
  outputRootDir: string,
  manager: RscPluginManagerLike | undefined
): void {
  const manifest = manager?.buildAssetsManifest;
  const environments = manager?.config?.environments;
  if (!manifest || !environments) {
    return;
  }

  const manifestContent = serializeBuildAssetsManifest(manifest);
  const candidateEnvironmentNames = ['rsc', 'ssr'];

  for (const envName of candidateEnvironmentNames) {
    const outDir = environments[envName]?.build?.outDir;
    if (!outDir) {
      continue;
    }

    const relativeDir = getRelativeDirFromRoot(outputRootDir, outDir);
    if (!relativeDir) {
      continue;
    }

    const manifestPath = `${relativeDir}/__vite_rsc_assets_manifest.js`;
    assets[manifestPath] = {
      content: manifestContent,
      type: 'application/javascript',
    };
  }
}

export function detectEntrypointFromBundle(
  outputRootDir: string,
  bundleDir: string,
  bundle: OutputBundleLike,
  currentEntrypoint?: string
): string | undefined {
  if (currentEntrypoint === 'server/index.js') {
    return currentEntrypoint;
  }

  const relativeDir = getRelativeBundleDir(outputRootDir, bundleDir);
  const fileNames = new Set(Object.values(bundle).map((item) => item.fileName));

  if (relativeDir === 'server' && fileNames.has('index.js')) {
    return 'server/index.js';
  }

  const hasWranglerConfig =
    fileNames.has('wrangler.json') || fileNames.has('wrangler.jsonc');
  if (
    relativeDir &&
    relativeDir !== 'client' &&
    hasWranglerConfig &&
    fileNames.has('index.js')
  ) {
    return `${relativeDir}/index.js`;
  }

  return currentEntrypoint;
}

export function resolveVinextEntrypoint(
  outputDir: string,
  detectedEntrypoint?: string,
  overrideEntrypoint?: string
): string {
  if (overrideEntrypoint) {
    return normalizeEntrypoint(overrideEntrypoint);
  }

  if (detectedEntrypoint) {
    return detectedEntrypoint;
  }

  throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
    message:
      `Could not infer Vinext entrypoint from emitted bundles for output root "${outputDir}". ` +
      'Set `entrypoint` explicitly in withZephyr({...}).',
  });
}
