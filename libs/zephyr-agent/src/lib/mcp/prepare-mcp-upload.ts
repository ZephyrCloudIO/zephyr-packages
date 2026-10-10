import {
  type EvalResults,
  type SnapshotMcp,
  type ZeBuildAsset,
  type ZephyrBuildStats,
  type ZephyrBuildStatsMcp,
  ZEPHYR_MCP_PROVIDER_FILENAME,
} from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import type { ZeApplicationConfig } from '../node-persist/upload-provider-options';
import { formatEvalResultsIssues, validateEvalResults } from './validate-eval-results';
import { formatMcpArtifactIssues, validateMcpArtifact } from './validate-mcp-artifact';

/** Deadline for the synchronous MCP build-stats request (`waitForCompletion`). */
export const MCP_BUILD_STATS_DEADLINE_MS = 120_000;

export interface McpUploadPlan {
  snapshot: SnapshotMcp;
  buildStats: ZephyrBuildStatsMcp;
}

export interface PrepareMcpUploadInput {
  /** Upload assets indexed by canonical `/` snapshot path (before baseHref). */
  assetsByPath: ReadonlyMap<string, ZeBuildAsset>;
  appConfig: Pick<ZeApplicationConfig, 'MCP_PRIVATE_SNAPSHOTS'>;
  baseHref: string | undefined;
  evalResults?: EvalResults;
  warn?: (message: string) => void;
}

/**
 * Detect and validate an MCP provider upload (contract section 3). Returns `undefined`
 * for every other output. Throws ERR_DEPLOY_LOCAL_BUILD before anything is uploaded when
 * the application is not eligible for private MCP snapshots or the artifact is invalid.
 */
export function prepareMcpUpload({
  assetsByPath,
  appConfig,
  baseHref,
  evalResults,
  warn,
}: PrepareMcpUploadInput): McpUploadPlan | undefined {
  if (!assetsByPath.has(ZEPHYR_MCP_PROVIDER_FILENAME)) {
    const nested = [...assetsByPath.keys()].filter((path) =>
      path.endsWith(`/${ZEPHYR_MCP_PROVIDER_FILENAME}`)
    );
    if (nested.length > 0) {
      warn?.(
        `Ignoring nested ${ZEPHYR_MCP_PROVIDER_FILENAME} (${nested.slice(0, 3).join(', ')}): ` +
          'only a descriptor at the output root publishes an MCP provider.'
      );
    }
    if (evalResults) {
      throw mcpError(
        'Eval results can only be attached to an MCP provider deploy, but the output has no root mcp-provider.json.'
      );
    }
    return undefined;
  }

  if (appConfig.MCP_PRIVATE_SNAPSHOTS !== true) {
    throw mcpError(
      'This application is not eligible for private MCP snapshots. MCP providers deploy only to the default Zephyr Cloudflare edge without additional environment edges.'
    );
  }
  if (baseHref !== undefined && baseHref !== '' && baseHref !== '/') {
    throw mcpError('MCP providers cannot be deployed with a baseHref other than "/".');
  }

  const files = new Map<string, Uint8Array>();
  for (const [path, asset] of assetsByPath) {
    files.set(path, toBytes(asset.buffer));
  }
  const validation = validateMcpArtifact(files);
  const { descriptor, catalog, catalogSha256 } = validation;
  if (validation.issues.length > 0 || !descriptor || !catalog || !catalogSha256) {
    throw mcpError(
      `Invalid MCP provider artifact:\n${formatMcpArtifactIssues(validation.issues)}`
    );
  }

  if (evalResults) {
    const result = validateEvalResults(
      evalResults,
      new Set(catalog.skills.map((skill) => skill.name))
    );
    if (result.issues.length > 0) {
      throw mcpError(`Invalid eval results:\n${formatEvalResultsIssues(result.issues)}`);
    }
  }

  const entry = catalog.runtime?.entry;
  return {
    snapshot: {
      manifestVersion: 1,
      name: descriptor.name,
      descriptor: ZEPHYR_MCP_PROVIDER_FILENAME,
      catalog: descriptor.catalog,
      catalogSha256,
      ...(entry ? { entry } : {}),
    },
    buildStats: {
      manifestVersion: 1,
      descriptor,
      catalog,
      catalogSha256,
      ...(evalResults ? { evalResults } : {}),
    },
  };
}

/**
 * Build stats for an MCP provider version: no remote entry, no MF manifest, and a
 * synchronous publish so the API's validation result reaches the deployer.
 */
export function withMcpBuildStats(
  buildStats: ZephyrBuildStats,
  mcp: ZephyrBuildStatsMcp
): ZephyrBuildStats {
  const { mf_manifest: _mfManifest, ...rest } = buildStats;
  return { ...rest, remote: '', waitForCompletion: true, mcp };
}

function toBytes(buffer: Buffer | string): Uint8Array {
  return typeof buffer === 'string' ? Buffer.from(buffer, 'utf8') : buffer;
}

function mcpError(message: string): ZephyrError<'ERR_DEPLOY_LOCAL_BUILD'> {
  return new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, { message });
}
