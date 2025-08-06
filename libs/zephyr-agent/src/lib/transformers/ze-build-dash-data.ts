import type { ZephyrEngine } from '../../zephyr-engine';
import type { ZephyrBuildStats } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';

export async function zeBuildDashData(
  zephyr_engine: ZephyrEngine
): Promise<ZephyrBuildStats> {
  const snapshotId = await zephyr_engine.snapshotId;
  const buildId = await zephyr_engine.build_id;
  if (!snapshotId) {
    throw new ZephyrError(ZeErrors.ERR_SNAPSHOT_ID_NOT_FOUND);
  }

  if (!buildId) {
    throw new ZephyrError(ZeErrors.ERR_GET_BUILD_ID);
  }

  const application_uid = zephyr_engine.application_uid;
  const isCI = zephyr_engine.env.isCI;

  const git = zephyr_engine.gitProperties.git;
  const app = zephyr_engine.applicationProperties;
  const name = zephyr_engine.applicationProperties.name;

  const {
    EDGE_URL: edge_url,
    username,
    DELIMITER: delimiter,
  } = await zephyr_engine.application_configuration;

  const to_raw = _recordToRawDependency;

  // Extract MCP metadata from package.json or MCP plugin options
  const mcpMetadata = _extractMCPMetadata(zephyr_engine);
  const isMCPProject = zephyr_engine.env.target === 'mcp';

  return {
    id: application_uid,
    name,
    environment: '',
    edge: { url: edge_url, delimiter },
    app: Object.assign({}, app, {
      buildId,
    }),
    version: snapshotId,
    git,
    context: { isCI, username },
    dependencies: to_raw(zephyr_engine.npmProperties.dependencies),
    devDependencies: to_raw(zephyr_engine.npmProperties.devDependencies),
    optionalDependencies: to_raw(zephyr_engine.npmProperties.optionalDependencies),
    peerDependencies: to_raw(zephyr_engine.npmProperties.peerDependencies),

    overrides: [],
    consumes: [],
    modules: [],
    remotes: zephyr_engine.federated_dependencies?.map((r) => r.name) ?? [],
    tags: [],
    project: '',
    metadata: {},
    default: false,
    remote: 'remoteEntry.js',
    type: 'app',
    build_target: isMCPProject ? 'mcp' : 'web',
    mcp_version: mcpMetadata.version,
    mcp_capabilities: mcpMetadata.capabilities,
    mcp_metadata: mcpMetadata.metadata,
  };
}

interface RawDependency {
  name: string;
  version: string;
}

function _recordToRawDependency(
  record: Record<string, string> | undefined
): RawDependency[] {
  if (!record) return [];
  return Object.entries(record).map(([name, version]) => ({ name, version }));
}

interface MCPMetadataResult {
  version?: string;
  capabilities?: {
    tools?: string[];
    resources?: string[];
    prompts?: string[];
    [key: string]: unknown;
  };
  metadata?: {
    name?: string;
    description?: string;
    author?: string;
    homepage?: string;
    documentation?: string;
    [key: string]: unknown;
  };
}

/** Extract MCP metadata from plugin configuration - MCP options are mandatory */
function _extractMCPMetadata(zephyr_engine: ZephyrEngine): MCPMetadataResult {
  // Check if this is an MCP project
  if (zephyr_engine.env.target !== 'mcp') {
    return {};
  }

  // MCP projects MUST have configuration set by the plugin
  if (!zephyr_engine.mcpConfiguration) {
    throw new ZephyrError(ZeErrors.ERR_CONVERT_GRAPH_TO_DASHBOARD);
  }

  return {
    version: zephyr_engine.mcpConfiguration.version,
    capabilities: zephyr_engine.mcpConfiguration.capabilities,
    metadata: zephyr_engine.mcpConfiguration.metadata,
  };
}
