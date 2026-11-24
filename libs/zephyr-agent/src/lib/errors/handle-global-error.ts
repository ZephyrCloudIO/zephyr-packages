import { isCI } from 'ci-info';
import { hasCiToken } from '../node-persist/ci-token';
import { logFn } from '../logging/ze-log-event';
import { ZeErrors } from './codes';
import { ZephyrError } from './zephyr-error';

export interface HandleGlobalErrorOptions {
  /**
   * Rethrow the error so the build fails. When set, it takes precedence over the
   * `ZE_FAIL_BUILD` environment variable. When both are unset, errors are rethrown in CI
   * with a nonempty `ZE_CI_TOKEN`, a write a permission profile denied (`ZE10038`) is
   * rethrown in any CI run, and errors are logged otherwise.
   */
  failBuild?: boolean;
}

function isPermissionDenial(error: unknown): boolean {
  return (
    ZephyrError.is(error) &&
    ZephyrError.fromZeCode(error.reason) === ZeErrors.ERR_DEPLOY_DENIED
  );
}

/**
 * Whether `error` fails the build. An explicit `failBuild` or `ZE_FAIL_BUILD` decides
 * first, so an app of a monorepo can opt out. Without one, a write a permission profile
 * denied (`ZE10038`, also as the reason of a wrapper) fails every CI run, whatever
 * credential it used: production must not stay behind without notice
 * (ZephyrCloudIO/zephyr-cloud-io#4005). A local build logs it.
 *
 * TODO(ZephyrCloudIO/zephyr-cloud-io#4592): each denied app fails on its own; a monorepo
 * run does not list them together at the end.
 */
export function shouldFailBuild(
  options: HandleGlobalErrorOptions = {},
  error?: unknown
): boolean {
  if (options.failBuild !== undefined) return options.failBuild;
  const failBuildEnv = process.env['ZE_FAIL_BUILD'];
  if (failBuildEnv !== undefined) return failBuildEnv === 'true';
  if (isCI && isPermissionDenial(error)) return true;
  return isCI && hasCiToken();
}

/**
 * Handles errors globally by either throwing them or logging them and allowing execution
 * to continue.
 *
 * @param error - The error to handle
 * @param options - `failBuild` overrides the `ZE_FAIL_BUILD` environment variable
 * @throws The error when the option, the environment override or the CI default enables
 *   failure
 */
export function handleGlobalError(
  error: unknown,
  options: HandleGlobalErrorOptions = {}
): void {
  if (shouldFailBuild(options, error)) {
    throw error;
  }

  logFn('error', ZephyrError.format(error));
}
