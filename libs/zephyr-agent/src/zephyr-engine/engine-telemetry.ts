import { ZE_ENV } from 'zephyr-edge-contract';
import { ZephyrError } from '../lib/errors';
import { type RequestIdentity, withRequestIdentity } from '../lib/http/request-identity';
import type { LogContext, ZeLogger } from '../lib/logging/ze-log-event';
import { DEFAULT_LOG_FLUSH_TIMEOUT_MS, settleWithin } from '../lib/utils/settle-within';
import { getZephyrAgentVersion } from '../lib/version/zephyr-agent-version';
import { BuildSessionAbortedError } from './build-session';
import type { ZephyrEngine } from './index';

let cachedAgentVersion: string | undefined;

function agentVersion(): string | undefined {
  cachedAgentVersion ??= getZephyrAgentVersion();
  return cachedAgentVersion === 'unknown' ? undefined : cachedAgentVersion;
}

/** The `context` group sent with every remote log event of this engine. */
export function engineLogContext(zephyr_engine: ZephyrEngine): LogContext {
  return {
    builder: zephyr_engine.builder === 'unknown' ? undefined : zephyr_engine.builder,
    plugin: zephyr_engine.plugin_identity?.name,
    plugin_version: zephyr_engine.plugin_identity?.version,
    agent_version: agentVersion(),
    node_version: process.versions.node,
    ci: zephyr_engine.env?.isCI,
    target: zephyr_engine.env?.target,
    env: zephyr_engine.env?.env ?? ZE_ENV(),
  };
}

async function settled<T>(
  promise: Promise<T> | null | undefined
): Promise<T | undefined> {
  try {
    return (await promise) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Who is building: known from engine creation on, before any build ID exists. */
export function engineBuilderIdentity(zephyr_engine: ZephyrEngine): RequestIdentity {
  return {
    builder: zephyr_engine.builder,
    plugin: zephyr_engine.plugin_identity?.name,
    pluginVersion: zephyr_engine.plugin_identity?.version,
  };
}

/** The application's edge origins, which are Zephyr endpoints. */
function applicationOrigins(
  appConfig: Awaited<ZephyrEngine['application_configuration']> | undefined
): string[] {
  return [
    appConfig?.EDGE_URL,
    appConfig?.BUILD_ID_ENDPOINT,
    ...Object.values(appConfig?.ENVIRONMENTS ?? {}).map((env) => env?.edgeUrl),
  ].filter((origin): origin is string => typeof origin === 'string' && !!origin);
}

function buildIdHeaderValue(buildId: unknown): string | undefined {
  return typeof buildId === 'string' || typeof buildId === 'number'
    ? String(buildId)
    : undefined;
}

/**
 * Identity for requests made on behalf of the engine's current build: its build ID and
 * the application's edge origins, which are Zephyr endpoints. Never rejects.
 */
export async function engineRequestIdentity(
  zephyr_engine: ZephyrEngine
): Promise<RequestIdentity> {
  // Partially initialized engines (and test doubles) must still be able to make requests.
  const [buildId, appConfig] = await Promise.all([
    settled(zephyr_engine.build_id),
    settled(zephyr_engine.application_configuration),
  ]);

  return {
    ...engineBuilderIdentity(zephyr_engine),
    buildId: buildIdHeaderValue(buildId),
    zephyrOrigins: applicationOrigins(appConfig),
  };
}

/** Runs `fn` so every Zephyr request it makes carries this build's identity. */
export async function withEngineRequestIdentity<T>(
  zephyr_engine: ZephyrEngine,
  fn: () => Promise<T>
): Promise<T> {
  const identity = await engineRequestIdentity(zephyr_engine);
  return withRequestIdentity(identity, fn);
}

const PENDING = Symbol('pending');

/** The promise's value if it has already settled successfully, otherwise `PENDING`. */
async function peek<T>(
  promise: Promise<T> | null | undefined
): Promise<T | typeof PENDING | undefined> {
  if (!promise) return undefined;
  // `Promise.race` subscribes in order, so a promise that has already settled wins the
  // race against the immediately resolved marker. A pending one loses without delay.
  return Promise.race([promise, Promise.resolve(PENDING)]).catch(() => undefined);
}

/**
 * Like {@link withEngineRequestIdentity}, but never waits: the build ID is attached only
 * when it is already known. Used for requests that start alongside the build-ID fetch,
 * such as remote dependency resolution, which must not wait one extra round trip just to
 * carry a header. These requests only go to the API origin, which is always a Zephyr
 * endpoint, so no edge origins are needed.
 */
export async function withAvailableEngineRequestIdentity<T>(
  zephyr_engine: ZephyrEngine,
  fn: () => Promise<T>
): Promise<T> {
  const buildId = await peek(zephyr_engine.build_id);
  return withRequestIdentity(
    { ...engineBuilderIdentity(zephyr_engine), buildId: buildIdHeaderValue(buildId) },
    fn
  );
}

async function flushLogger(logger: Promise<ZeLogger> | undefined): Promise<void> {
  const log = await settled(logger);
  // Test doubles and older callers may provide a bare function.
  if (typeof log?.flush === 'function') await log.flush();
}

/**
 * Reports `build:failed` for the engine's active build, at most once per build, then
 * waits briefly for pending log sends. Every plugin reaches it through
 * `ZephyrEngine.build_failed(error)`.
 *
 * The checks run synchronously so callers can reset the build state right after calling
 * it. The returned promise never rejects and settles within `timeoutMs`, even while the
 * logger itself is still initializing; a late report is still sent in the background.
 */
export function reportBuildFailure(
  zephyr_engine: ZephyrEngine,
  error: unknown,
  timeoutMs = DEFAULT_LOG_FLUSH_TIMEOUT_MS
): Promise<void> {
  let delivery: Promise<void>;
  try {
    const logger = zephyr_engine.logger as Promise<ZeLogger> | undefined;
    const shouldReport =
      error !== undefined &&
      // A superseded watch generation is not a failed build.
      !(error instanceof BuildSessionAbortedError) &&
      zephyr_engine.hasActiveBuild &&
      !zephyr_engine.build_failure_reported &&
      !!logger;

    if (shouldReport) zephyr_engine.build_failure_reported = true;
    const startedAt = zephyr_engine.build_start_time;

    delivery = (async () => {
      if (shouldReport) {
        const log = await logger;
        log({
          level: 'error',
          action: 'build:failed',
          // A remote reader can't open the local error file, so don't write or cite one.
          message: ZephyrError.format(error, { errorFile: false }),
          // The plugin prints or rethrows the error itself; don't print it twice.
          remoteOnly: true,
          error,
          data: {
            outcome: 'failed',
            ...(startedAt ? { duration_ms: Date.now() - startedAt } : {}),
          },
        });
      }
      await flushLogger(logger);
    })();
  } catch {
    // Reporting is best effort: it must never fail or hang the build.
    return Promise.resolve();
  }

  // One deadline covers logger initialization, the send and the flush.
  return settleWithin([delivery], timeoutMs);
}
