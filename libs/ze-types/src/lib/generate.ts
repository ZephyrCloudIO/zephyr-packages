import path from 'node:path';
import fs from 'node:fs';
import { consumeTypesAPI } from '@module-federation/dts-plugin';
import type { ZephyrDependency } from 'zephyr-edge-contract';
import { fetchZephyrManifest, resolveZephyrManifestUrl } from './manifest';
import { writeTypesIndex } from './types-index';
import type { GenerateZeTypesOptions, GenerateZeTypesResult } from './types';
import { resolveZephyrDependencies } from './zephyr-deps';

const DEFAULT_REMOTE_TYPES_FOLDER = '@mf-types';
const PACKAGE_NAME = 'ze-types';

function logDebug(enabled: boolean, message: string, meta?: unknown) {
  if (!enabled) return;
  if (meta) {
     
    console.log(`[${PACKAGE_NAME}] ${message}`, meta);
    return;
  }
   
  console.log(`[${PACKAGE_NAME}] ${message}`);
}

function findPackageRoot(startDir: string): string {
  let current = startDir;
  while (true) {
    const pkgPath = path.join(current, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const raw = fs.readFileSync(pkgPath, 'utf8');
        const pkg = JSON.parse(raw) as { name?: string };
        if (pkg.name === PACKAGE_NAME) {
          return current;
        }
      } catch {
        // ignore
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
}

function resolveTypesFolder(packageRoot: string): string {
  const distGenerated = path.join(packageRoot, 'dist', 'generated');
  if (fs.existsSync(distGenerated)) {
    return distGenerated;
  }
  const srcGenerated = path.join(packageRoot, 'src', 'generated');
  if (fs.existsSync(srcGenerated)) {
    return srcGenerated;
  }
  return distGenerated;
}

async function collectRemotes(
  urls: string[],
  debug: boolean
): Promise<{ remotes: Record<string, string>; manifestUrls: string[] }> {
  const remotes: Record<string, string> = {};
  const manifestUrls = urls.map(resolveZephyrManifestUrl);

  for (const manifestUrl of manifestUrls) {
    logDebug(debug, 'fetching manifest', manifestUrl);
    const manifest = await fetchZephyrManifest(manifestUrl);
    const deps = manifest.dependencies ?? {};

    for (const [name, dep] of Object.entries(deps)) {
      const typedDep = dep as ZephyrDependency;
      const entry = typedDep.remote_entry_url || typedDep.default_url;
      if (!entry) continue;
      if (remotes[name] && remotes[name] !== entry) {
        logDebug(debug, `remote override: ${name}`, {
          previous: remotes[name],
          next: entry,
        });
      }
      remotes[name] = entry;
    }
  }

  return { remotes, manifestUrls };
}

export async function generateZeTypes(
  options: GenerateZeTypesOptions
): Promise<GenerateZeTypesResult> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const packageRoot = options.packageRoot ?? findPackageRoot(__dirname);
  const typesFolder = resolveTypesFolder(packageRoot);
  const debug = Boolean(options.debug);

  const manifestUrls = options.zephyrUrls ?? [];
  const usePackageJson = options.usePackageJson ?? manifestUrls.length === 0;

  if (!manifestUrls.length && !usePackageJson) {
    throw new Error('ze-types: missing Zephyr URL(s) or zephyr:dependencies');
  }

  const manifestRemotesResult = manifestUrls.length
    ? await collectRemotes(manifestUrls, debug)
    : { remotes: {}, manifestUrls: [] as string[] };

  const packageDepsResult = usePackageJson
    ? await resolveZephyrDependencies({
        projectRoot,
        packageJsonPath: options.packageJsonPath,
        token: options.token,
        abortOnError: options.abortOnError,
        debug,
      })
    : undefined;

  const remotes = {
    ...(packageDepsResult?.remotes ?? {}),
    ...manifestRemotesResult.remotes,
  };

  if (!Object.keys(remotes).length) {
    throw new Error('ze-types: no remotes resolved');
  }

  logDebug(debug, 'remotes', remotes);

  await consumeTypesAPI({
    host: {
      context: projectRoot,
      moduleFederationConfig: {
        name: PACKAGE_NAME,
        remotes,
      },
      typesFolder,
      remoteTypesFolder: options.remoteTypesFolder ?? DEFAULT_REMOTE_TYPES_FOLDER,
      deleteTypesFolder: true,
      abortOnError: options.abortOnError ?? false,
      consumeAPITypes: true,
      typesOnBuild: false,
    },
    extraOptions: {},
  });

  const sourceRefs = manifestRemotesResult.manifestUrls.length
    ? manifestRemotesResult.manifestUrls
    : packageDepsResult?.packageJsonPath
      ? [`package.json:${packageDepsResult.packageJsonPath}`]
      : [];

  await writeTypesIndex({
    typesRoot: typesFolder,
    remotes: Object.keys(remotes),
    sourceUrls: sourceRefs,
  });

  return {
    remotes,
    typesFolder,
    manifestUrls: manifestRemotesResult.manifestUrls,
    packageJsonPath: packageDepsResult?.packageJsonPath,
  };
}
