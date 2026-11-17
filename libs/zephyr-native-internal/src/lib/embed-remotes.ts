import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { logFn, ZeErrors, ZephyrError, type ZeResolvedDependency } from 'zephyr-agent';
import { jsLiteral, writeGeneratedModule } from './generated-module';

/** What the embedded-remotes runtime plugin knows about one embedded remote. */
export interface EmbeddedRemoteRuntime {
  /** Remote name as the host declares it. */
  name: string;
  /** Module Federation global name of the remote's container. */
  globalName: string;
  /** `mf-manifest.json` URL the build resolved. */
  manifestUrl: string;
  /** The manifest as downloaded at build time. */
  manifest: Record<string, unknown>;
  /** Manifest-relative file path → flat file name in the app binary root. */
  files: Record<string, string>;
}

/** A remote downloaded for embedding: its runtime description and its file contents. */
export interface DownloadedRemote {
  runtime: EmbeddedRemoteRuntime;
  files: Array<{ fileName: string; content: Buffer }>;
}

type Bundler = 'metro' | 'repack';

const FETCH_TIMEOUT_MS = 60_000;

function fail(detail: string): never {
  throw new ZephyrError(ZeErrors.ERR_EMBED_REMOTES, { detail });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Same as the env runtime plugin: entries may carry a `name@` prefix. */
function stripRemoteNamePrefix(entry: string): string {
  if (/^(?:https?:)?\/\//.test(entry)) return entry;
  const absoluteUrlIndex = entry.search(/https?:\/\//);
  if (absoluteUrlIndex > 0) return entry.slice(absoluteUrlIndex);
  return entry.slice(entry.lastIndexOf('@') + 1);
}

function directoryOf(url: string): string {
  const bare = url.replace(/[?#].*$/, '');
  return bare.slice(0, bare.lastIndexOf('/') + 1);
}

/** File name in the app binary root: Re.Pack and the native reader look files up by name. */
export function embeddedFileName(remoteName: string, relativePath: string): string {
  const digest = createHash('sha256')
    .update(`${remoteName}\0${relativePath}`)
    .digest('hex')
    .slice(0, 16);
  const base = path.posix.basename(relativePath).replace(/[^A-Za-z0-9._-]/g, '_');
  return `zephyr-remote-${digest}-${base}`;
}

async function download(name: string, url: string): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`remote "${name}": GET ${url} failed: ${message}`);
  }
  if (!response.ok) {
    fail(`remote "${name}": GET ${url} returned HTTP ${response.status}`);
  }
  try {
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`remote "${name}": GET ${url} failed: ${message}`);
  }
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function itemsOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function jsAssets(item: Record<string, unknown>): { sync: string[]; async: string[] } {
  const assets = item['assets'];
  const js = isRecord(assets) ? assets['js'] : undefined;
  return isRecord(js)
    ? { sync: stringsOf(js['sync']), async: stringsOf(js['async']) }
    : { sync: [], async: [] };
}

/** Manifest-relative paths of every file the remote's container and modules load. */
function manifestFiles(
  manifest: Record<string, unknown>,
  remoteEntry: Record<string, unknown>,
  bundler: Bundler
): string[] {
  const entryName = remoteEntry['name'] as string;
  const entryPath = typeof remoteEntry['path'] === 'string' ? remoteEntry['path'] : '';
  const files = [entryPath ? `${entryPath}/${entryName}` : entryName];
  const exposes = itemsOf(manifest['exposes']);
  const shared = itemsOf(manifest['shared']);

  if (bundler === 'metro') {
    // Production paths of zephyr-native-cache's resolveBundlePaths.
    for (const item of exposes) {
      if (typeof item['name'] === 'string') {
        files.push(`exposed/${item['name']}.bundle`);
      } else {
        files.push(...jsAssets(item).sync.map((p) => p.replace(/\.\w+$/, '.bundle')));
      }
    }
    for (const item of shared) {
      files.push(...jsAssets(item).sync.map((p) => p.replace(/\.\w+$/, '.bundle')));
    }
  } else {
    for (const item of [...exposes, ...shared]) {
      const { sync, async } = jsAssets(item);
      files.push(...sync, ...async);
    }
  }
  return [...new Set(files.map((file) => file.replace(/^(?:\.\/|\/)+/, '')))];
}

async function downloadRemote(
  name: string,
  dependency: ZeResolvedDependency,
  bundler: Bundler
): Promise<DownloadedRemote> {
  let manifestUrl: string;
  if (dependency.manifest_url) {
    manifestUrl = stripRemoteNamePrefix(dependency.manifest_url);
  } else if (bundler === 'repack') {
    manifestUrl = `${directoryOf(stripRemoteNamePrefix(dependency.remote_entry_url))}mf-manifest.json`;
  } else {
    fail(`remote "${name}" has no mf-manifest.json URL`);
  }

  const manifestBytes = await download(name, manifestUrl);
  let manifest: unknown;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch {
    manifest = undefined;
  }
  const metaData = isRecord(manifest) ? manifest['metaData'] : undefined;
  const remoteEntry = isRecord(metaData) ? metaData['remoteEntry'] : undefined;
  if (
    !isRecord(manifest) ||
    !isRecord(metaData) ||
    !isRecord(remoteEntry) ||
    typeof remoteEntry['name'] !== 'string'
  ) {
    fail(`remote "${name}": ${manifestUrl} is not a Module Federation manifest`);
  }

  const publicPath = metaData['publicPath'];
  const base =
    typeof publicPath === 'string' && /^https?:\/\//.test(publicPath)
      ? publicPath.replace(/\/*$/, '/')
      : directoryOf(manifestUrl);

  const relativePaths = manifestFiles(manifest, remoteEntry, bundler);
  const byBasename = new Map<string, string>();
  for (const relativePath of relativePaths) {
    if (relativePath.split('/').includes('..') || /^[a-z]+:/i.test(relativePath)) {
      fail(`remote "${name}": unsafe file path "${relativePath}" in manifest`);
    }
    if (bundler === 'repack') {
      const basename = path.posix.basename(relativePath);
      const other = byBasename.get(basename);
      if (other !== undefined) {
        fail(
          `remote "${name}": files "${other}" and "${relativePath}" share a name; Re.Pack loads remote files by name`
        );
      }
      byBasename.set(basename, relativePath);
    }
  }

  const files = await Promise.all(
    relativePaths.map(async (relativePath) => ({
      relativePath,
      fileName: embeddedFileName(name, relativePath),
      content: await download(name, `${base}${relativePath}`),
    }))
  );

  const globalName =
    typeof metaData['globalName'] === 'string'
      ? metaData['globalName']
      : typeof manifest['name'] === 'string'
        ? manifest['name']
        : name;
  const bytes = files.reduce((total, file) => total + file.content.length, 0);
  logFn(
    'info',
    `Embedded remote "${name}": ${files.length} files, ${Math.round(bytes / 1024)} KB`
  );

  return {
    runtime: {
      name,
      globalName,
      manifestUrl,
      manifest,
      files: Object.fromEntries(files.map((file) => [file.relativePath, file.fileName])),
    },
    files: files.map(({ fileName, content }) => ({ fileName, content })),
  };
}

/**
 * Downloads every declared remote, as the build resolved it, with the files its
 * `mf-manifest.json` lists. Fails with ERR_EMBED_REMOTES naming the remote when one
 * cannot be embedded.
 */
export async function downloadEmbeddedRemotes(params: {
  declared: readonly string[];
  resolved: readonly ZeResolvedDependency[];
  exclude: readonly string[];
  bundler: Bundler;
}): Promise<DownloadedRemote[]> {
  const { declared, resolved, exclude, bundler } = params;
  for (const name of exclude) {
    if (!declared.includes(name)) {
      logFn('warn', `embedRemotes.exclude: "${name}" is not a remote of this app`);
    }
  }

  const names = [...new Set(declared)].filter((name) => !exclude.includes(name));
  return Promise.all(
    names.map((name) => {
      const dependency = resolved.find((candidate) => candidate.name === name);
      if (!dependency) {
        fail(
          `remote "${name}" did not resolve to a Zephyr deployment; fix it or add it to embedRemotes.exclude`
        );
      }
      return downloadRemote(name, dependency, bundler);
    })
  );
}

/** Writes the downloaded files, flat, into the directory the native build packages. */
export function writeEmbeddedRemoteFiles(
  remotes: readonly DownloadedRemote[],
  destDir: string
): void {
  mkdirSync(destDir, { recursive: true });
  for (const remote of remotes) {
    for (const { fileName, content } of remote.files) {
      writeFileSync(path.join(destDir, fileName), content);
    }
  }
}

/**
 * Writes the MF runtime plugin module that binds the embedded remotes' manifests and file
 * names to the embedded-remotes runtime plugin, and returns its absolute path.
 */
export function writeEmbeddedRemotesRuntimePlugin(
  outDir: string,
  remotes: readonly DownloadedRemote[],
  bundler: Bundler
): string {
  // CJS build of src/runtime/embedded-remotes-plugin.ts (dist/lib → dist/runtime). An
  // absolute path, because under pnpm the app cannot resolve zephyr-native-internal.
  const runtimePath = path.join(__dirname, '..', 'runtime', 'embedded-remotes-plugin.js');
  const options =
    bundler === 'metro'
      ? "{ bundler: 'metro' }"
      : "{ bundler: 'repack', getScriptManager: function () { return require('@callstack/repack/client').ScriptManager.shared; } }";
  const source = `'use strict';\nvar createEmbeddedRemotesPlugin = require(${JSON.stringify(runtimePath)}).createEmbeddedRemotesPlugin;\nvar REMOTES = ${jsLiteral(remotes.map((remote) => remote.runtime))};\nmodule.exports = function zephyrEmbeddedRemotesPlugin() {\n  return createEmbeddedRemotesPlugin(REMOTES, ${options});\n};\n`;
  return writeGeneratedModule(outDir, 'embedded-remotes-plugin', source);
}
