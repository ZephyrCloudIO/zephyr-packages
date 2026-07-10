import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parse } from 'yaml';
import type { ZephyrEngine } from 'zephyr-agent';
import type { ZephyrBuildStats } from 'zephyr-edge-contract';

interface PnpmWorkspaceCatalogs {
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
}

// Create minimal build stats for Metro builds
export async function createMinimalBuildStats(
  zephyr_engine: ZephyrEngine
): Promise<Partial<ZephyrBuildStats>> {
  const app = zephyr_engine.applicationProperties;
  const { git } = zephyr_engine.gitProperties;
  const { isCI } = zephyr_engine.env;

  const version = (await zephyr_engine.snapshotId) || '0.0.0';
  const application_uid = zephyr_engine.application_uid;
  const buildId = (await zephyr_engine.build_id) || 'unknown';
  const { EDGE_URL, PLATFORM, DELIMITER } = await zephyr_engine.application_configuration;

  return {
    id: application_uid,
    name: app.name,
    version,
    project: app.name || 'unknown-project',
    app: Object.assign({}, app, { buildId }) as any,
    git,
    context: { isCI },
    tags: [],
    edge: { url: EDGE_URL, delimiter: DELIMITER },
    platform: PLATFORM as any,
    type: 'app' as any,
    environment: '',
    default: false,
    overrides: [],
    modules: [],
    consumes: [],
    dependencies: [],
    devDependencies: [],
    optionalDependencies: [],
    peerDependencies: [],
    remotes: [],
  };
}

function findWorkspaceCatalogs(
  startDirectory: string
): PnpmWorkspaceCatalogs | undefined {
  let directory = resolve(startDirectory);

  while (true) {
    const workspacePath = join(directory, 'pnpm-workspace.yaml');

    if (existsSync(workspacePath)) {
      return parse(readFileSync(workspacePath, 'utf8')) as PnpmWorkspaceCatalogs;
    }

    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

function resolveCatalogVersion(
  name: string,
  reference: string,
  catalogs: PnpmWorkspaceCatalogs | undefined
): string {
  if (!catalogs) return reference;

  const catalogName = reference.slice('catalog:'.length);
  const catalog = catalogName ? catalogs.catalogs?.[catalogName] : catalogs.catalog;

  return catalog?.[name] ?? reference;
}

export function resolveCatalogDependencies(
  dependencies: Record<string, string> = {},
  startDirectory = process.cwd()
): Record<string, string> {
  const resolved: Record<string, string> = {};
  const catalogs = findWorkspaceCatalogs(startDirectory);

  for (const [name, version] of Object.entries(dependencies)) {
    resolved[name] = version.startsWith('catalog:')
      ? resolveCatalogVersion(name, version, catalogs)
      : version;
  }

  return resolved;
}
