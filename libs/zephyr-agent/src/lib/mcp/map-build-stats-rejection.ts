import { ZeErrors, ZephyrError } from '../errors';
import { isPlainObject } from './mcp-rules';

const MAX_ISSUE_PATHS = 20;

/** Agent-owned explanations for API rejections whose reason is not in the issue paths. */
const CONFLICT_HINT =
  'An application is either an MCP provider or a regular application. If this application already has non-MCP versions, publish the MCP provider as its own application.';
const DEFAULT_EDGE_HINT =
  'MCP providers deploy only to the default Zephyr Cloudflare edge. Remove the custom edge integration from this application and its environments, or publish the MCP provider as its own application.';

/**
 * Map an API 4xx for a synchronous MCP build-stats request to ERR_DEPLOY_LOCAL_BUILD.
 * Only issue paths are surfaced, never values or messages, because the API echoes user
 * input. Known guard rejections (409 presence conflict, 422 at `mcp` for a non-default
 * edge) get fixed text so the deployer learns why. Returns `undefined` for anything that
 * is not a client error so the caller keeps its normal transport error.
 */
export function mapMcpBuildStatsRejection(
  status: number,
  body: unknown
): ZephyrError<'ERR_DEPLOY_LOCAL_BUILD'> | undefined {
  if (status < 400 || status >= 500) return undefined;
  const paths = extractIssuePaths(body);
  const lines = paths.length
    ? [`Rejected fields:\n${paths.map((path) => `- ${path}`).join('\n')}`]
    : [
        status === 403
          ? 'No issue paths were returned; check that your account can publish this application.'
          : 'No issue paths were returned.',
      ];
  if (status === 409) lines.push(CONFLICT_HINT);
  if (status === 422 && paths.length === 1 && paths[0] === 'mcp') {
    lines.push(DEFAULT_EDGE_HINT);
  }
  return new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
    message: `The Zephyr API rejected the MCP provider version (HTTP ${status}).\n${lines.join('\n')}`,
  });
}

/** Collect `path` entries from common validation error shapes (zod-like issue lists). */
export function extractIssuePaths(body: unknown): string[] {
  const candidates: unknown[] = [];
  const collect = (value: unknown) => {
    if (Array.isArray(value)) candidates.push(...value);
  };
  if (isPlainObject(body)) {
    collect(body['issues']);
    collect(body['errors']);
    for (const key of ['error', 'details', 'value']) {
      const nested = body[key];
      if (isPlainObject(nested)) {
        collect(nested['issues']);
        collect(nested['errors']);
      }
    }
  }

  const paths = new Set<string>();
  for (const candidate of candidates) {
    if (!isPlainObject(candidate)) continue;
    const path = formatPath(candidate['path']);
    if (path) paths.add(path);
    if (paths.size >= MAX_ISSUE_PATHS) break;
  }
  return [...paths];
}

function formatPath(path: unknown): string | undefined {
  if (typeof path === 'string') return sanitizeSegment(path);
  if (!Array.isArray(path)) return undefined;
  const segments = path
    .filter((segment) => typeof segment === 'string' || typeof segment === 'number')
    .map((segment) => sanitizeSegment(String(segment)));
  return segments.length ? segments.join('.') : '(root)';
}

function sanitizeSegment(segment: string): string {
  // Paths are field names and indexes; cap them so a reflected value cannot leak through.
  return segment.replace(/[^\w.$[\]-]/g, '_').slice(0, 64);
}
