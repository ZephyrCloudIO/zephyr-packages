import { AsyncLocalStorage } from 'node:async_hooks';
import { ZE_API_ENDPOINT, ZEPHYR_API_ENDPOINT } from 'zephyr-edge-contract';
import { ZE_BUILD_ID_HEADER, ZE_USER_AGENT_PRODUCT } from '../logging/telemetry-contract';
import { getZephyrAgentVersion } from '../version/zephyr-agent-version';

/**
 * Who is making a request. `fetchWithRetries` turns it into the `User-Agent` and
 * `x-ze-build-id` headers, and only for Zephyr endpoints.
 */
export interface RequestIdentity {
  /** Resolved build ID, sent exactly as `x-ze-build-id`. */
  buildId?: string;
  builder?: string;
  plugin?: string;
  pluginVersion?: string;
  /**
   * Zephyr endpoints known for this scope beyond the API, such as the application's
   * `EDGE_URL`. Only exact origins receive the identity headers.
   */
  zephyrOrigins?: readonly string[];
}

// Scoped per async call chain, so concurrent builds in one process (for example two
// Vite environments) each keep their own build ID. Nothing outside a scope sees it.
const requestIdentityScope = new AsyncLocalStorage<RequestIdentity>();

/**
 * Runs `fn` with `identity` applied to every agent request it makes, including those made
 * later by promises it starts. A nested scope adds to the outer one.
 */
export function withRequestIdentity<T>(identity: RequestIdentity, fn: () => T): T {
  const parent = requestIdentityScope.getStore();
  return requestIdentityScope.run(mergeIdentity(parent, identity), fn);
}

/** The identity of the current scope, if any. */
export function getRequestIdentity(): RequestIdentity | undefined {
  return requestIdentityScope.getStore();
}

function mergeIdentity(
  parent: RequestIdentity | undefined,
  child: RequestIdentity
): RequestIdentity {
  if (!parent) return child;
  return {
    buildId: child.buildId ?? parent.buildId,
    builder: child.builder ?? parent.builder,
    plugin: child.plugin ?? parent.plugin,
    pluginVersion: child.pluginVersion ?? parent.pluginVersion,
    zephyrOrigins: [...(parent.zephyrOrigins ?? []), ...(child.zephyrOrigins ?? [])],
  };
}

let cachedAgentVersion: string | undefined;

function agentVersion(): string {
  cachedAgentVersion ??= getZephyrAgentVersion();
  return cachedAgentVersion;
}

/** Keeps a User-Agent token to characters that are safe in a header value. */
function sanitizeToken(value: string | undefined): string | undefined {
  const token = value?.replace(/[^\w.@/+~-]/g, '').slice(0, 100);
  return token || undefined;
}

/**
 * `zephyr-agent/<agent_version> (<builder>; <plugin>/<plugin_version>;
 * node/<node_version>)`, dropping the parts that are unknown.
 */
export function formatUserAgent(
  identity: Pick<RequestIdentity, 'builder' | 'plugin' | 'pluginVersion'> = {}
): string {
  const builder = sanitizeToken(identity.builder);
  const plugin = sanitizeToken(identity.plugin);
  const pluginVersion = sanitizeToken(identity.pluginVersion);
  const nodeVersion = sanitizeToken(process.versions.node);

  const details = [
    builder !== 'unknown' ? builder : undefined,
    plugin && (pluginVersion ? `${plugin}/${pluginVersion}` : plugin),
    nodeVersion && `node/${nodeVersion}`,
  ].filter(Boolean);

  const product = `${ZE_USER_AGENT_PRODUCT}/${sanitizeToken(agentVersion()) ?? 'unknown'}`;
  return details.length ? `${product} (${details.join('; ')})` : product;
}

function toOrigin(value: string | URL): string | undefined {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

/**
 * Whether `url` is a Zephyr endpoint: the API gateway, the API, or an origin the current
 * scope declared. Presigned storage URLs and anything else are never Zephyr endpoints.
 */
export function isZephyrEndpoint(url: URL, identity?: RequestIdentity): boolean {
  const origin = url.origin;
  if (origin === 'null') return false;
  const zephyrOrigins = [
    ZE_API_ENDPOINT(),
    ZEPHYR_API_ENDPOINT(),
    ...(identity?.zephyrOrigins ?? []),
  ];
  return zephyrOrigins.some((candidate) => toOrigin(candidate) === origin);
}

/**
 * Identity headers for a request to `url`. Returns nothing for non-Zephyr endpoints so
 * build details never reach third parties and signed requests stay untouched.
 */
export function getRequestIdentityHeaders(
  url: URL,
  identity: RequestIdentity | undefined = getRequestIdentity()
): Record<string, string> {
  if (!isZephyrEndpoint(url, identity)) return {};

  const headers: Record<string, string> = { 'User-Agent': formatUserAgent(identity) };
  // Sent exactly as resolved (the same string as the logs' `zeBuildId`). A value that is
  // not a valid header token is left out rather than altered.
  const buildId = identity?.buildId;
  if (buildId && /^[\x21-\x7e]+$/.test(buildId)) {
    headers[ZE_BUILD_ID_HEADER] = buildId;
  }
  return headers;
}
