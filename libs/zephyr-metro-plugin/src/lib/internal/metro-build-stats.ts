import type { ZephyrEngine } from 'zephyr-agent';
import type { ZephyrBuildStats } from 'zephyr-edge-contract';

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

// Simple catalog dependencies resolver for Metro
export function resolveCatalogDependencies(
  dependencies: Record<string, string> = {}
): Record<string, string> {
  const resolved: Record<string, string> = {};

  for (const [name, version] of Object.entries(dependencies)) {
    if (version.startsWith('catalog:')) {
      // For Metro plugin, we'll just use a default version for catalog references
      // In a real implementation, this would resolve from a catalog file
      resolved[name] = '0.0.0';
    } else {
      resolved[name] = version;
    }
  }

  return resolved;
}
