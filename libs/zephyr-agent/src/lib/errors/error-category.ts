import { ZeErrors, type ZeErrorCodes, type ZeErrorKeys } from './codes';
import { ZephyrError } from './zephyr-error';

/**
 * What a person or an agent should conclude from an error, whatever code carries it.
 *
 * - `unreachable`: Zephyr could not be reached or failed on its side (network, DNS,
 *   timeout, HTTP 5xx). Nothing to fix locally. Retry later.
 * - `auth`: the credentials are missing, invalid or expired. Refresh them.
 * - `forbidden`: the credentials are valid but the account lacks access. Change access.
 * - `config`: the project or Zephyr configuration is wrong. Correct it.
 * - `build`, `deploy`, `browser`: a failure in that stage of the Zephyr workflow.
 * - `unknown`: not classified.
 */
export type ZephyrErrorCategory =
  | 'unreachable'
  | 'auth'
  | 'forbidden'
  | 'config'
  | 'build'
  | 'deploy'
  | 'browser'
  | 'unknown';

/** Auth codes keep their historical `ZE10xxx` numbers, so the category is mapped here. */
const AUTH_ERRORS: ReadonlySet<ZeErrorKeys> = new Set<ZeErrorKeys>([
  'ERR_AUTH_ERROR',
  'ERR_NO_JWT',
  'ERR_JWT_INVALID',
  'ERR_CI_TOKEN_AUTH',
]);

const FORBIDDEN_ERRORS: ReadonlySet<ZeErrorKeys> = new Set<ZeErrorKeys>([
  'ERR_AUTH_FORBIDDEN_ERROR',
]);

function keyOf(code: ZeErrorCodes): ZeErrorKeys | undefined {
  const type = ZephyrError.fromZeCode(code);
  return (Object.keys(ZeErrors) as ZeErrorKeys[]).find((key) => ZeErrors[key] === type);
}

/** Category of a Zephyr error code. Unlisted or malformed codes are `unknown`. */
export function getZephyrErrorCodeCategory(code: ZeErrorCodes): ZephyrErrorCategory {
  const key = keyOf(code);
  if (!key || key === 'ERR_UNKNOWN') return 'unknown';
  if (AUTH_ERRORS.has(key)) return 'auth';
  if (FORBIDDEN_ERRORS.has(key)) return 'forbidden';
  return ZeErrors[key].kind;
}

/**
 * Category of the root cause of an error. A wrapper such as `ZE20014` ("Failed to load
 * Application Configuration") keeps the code of its cause in `reason`, so an outage that
 * surfaces as `ZE20014` is still reported as `unreachable`.
 */
export function getZephyrErrorCategory(error: unknown): ZephyrErrorCategory {
  if (!ZephyrError.is(error)) return 'unknown';
  return getZephyrErrorCodeCategory(error.reason ?? (error.code as ZeErrorCodes));
}

/**
 * Whether Zephyr could not be reached, or failed on its side (network, DNS, timeout,
 * 5xx).
 */
export function isZephyrUnreachableError(error: unknown): boolean {
  return getZephyrErrorCategory(error) === 'unreachable';
}
