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
const SSG_MANIFEST = 'mf-ssg/mf-manifest.json';
const AUTO_PUBLIC_PATH_RUNTIME =
  '__webpack_require__.p=(()=>{var e;if(typeof document!="undefined"){var t=document.currentScript;if(t&&t.tagName==="SCRIPT")e=t.src;if(!e){var r=document.getElementsByTagName("script");if(r.length)e=r[r.length-1].src}}if(!e&&typeof location!="undefined")e=location.href;if(!e)return "/";return e.replace(/#.*$/,"").replace(/\\?.*$/,"").replace(/\\/[^\\/]*$/,"/")})()';

export async function rewriteRspressModuleFederationAssets(
  outDir: string,
  files: string[]
): Promise<void> {
  const normalizedFiles = new Set(files.map(toPortablePath));

  if (!normalizedFiles.has(BROWSER_MANIFEST)) {
    return;
  }

  const publicPaths = await collectManifestPublicPaths(outDir, normalizedFiles);
  await rewriteHtmlAssetPrefixes(outDir, files, publicPaths);
  await rewriteJsPublicPaths(outDir, files, publicPaths);
  await rewriteManifest(outDir, BROWSER_MANIFEST, normalizeBrowserManifest);

  if (normalizedFiles.has(SSG_MANIFEST)) {
    await rewriteManifest(outDir, SSG_MANIFEST, normalizeSsgManifest);
  }
}

async function collectManifestPublicPaths(
  outDir: string,
  files: Set<string>
): Promise<string[]> {
  const publicPaths = new Set<string>();

  for (const file of [BROWSER_MANIFEST, SSG_MANIFEST]) {
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
          source = source.split(publicPath).join('/');
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
  publicPaths: string[]
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
            ? AUTO_PUBLIC_PATH_RUNTIME
            : '__webpack_require__.p="/"';

        for (const publicPath of publicPaths) {
          source = source
            .split(`__webpack_require__.p=${JSON.stringify(publicPath)}`)
            .join(replacement);
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

function normalizeBrowserManifest(manifest: ModuleFederationManifest): void {
  if (!manifest.metaData) {
    return;
  }

  manifest.metaData.publicPath = 'auto';
  delete manifest.metaData.ssrPublicPath;

  if (manifest.metaData.ssrRemoteEntry) {
    manifest.metaData.ssrRemoteEntry = {
      ...manifest.metaData.ssrRemoteEntry,
      path: 'mf-ssg/',
      type: 'commonjs-module',
    };
  }
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
