import { isCI } from 'ci-info';
import { hasCiToken } from '../node-persist/ci-token';
import { logFn } from '../logging/ze-log-event';
import { ZephyrError } from './zephyr-error';

export interface HandleGlobalErrorOptions {
  /**
   * Rethrow the error so the build fails. When set, it takes precedence over the
   * `ZE_FAIL_BUILD` environment variable. When both are unset, errors are rethrown in CI
   * with a nonempty `ZE_CI_TOKEN` and logged otherwise.
   */
  failBuild?: boolean;
}

/**
 * Whether a Zephyr failure must fail the build. The option wins over `ZE_FAIL_BUILD`;
 * when both are unset, token-authenticated CI fails and everything else logs.
 */
export function shouldFailBuild(options: HandleGlobalErrorOptions = {}): boolean {
  return (
    options.failBuild ??
    (process.env['ZE_FAIL_BUILD'] !== undefined
      ? process.env['ZE_FAIL_BUILD'] === 'true'
      : isCI && hasCiToken())
  );
}

/**
 * Handles errors globally by either throwing them or logging them and allowing execution
 * to continue.
 *
 * @param error - The error to handle
 * @param options - `failBuild` overrides the `ZE_FAIL_BUILD` environment variable
 * @throws The error when the option, environment override, or token-authenticated CI
 *   default enables failure
 */
export function handleGlobalError(
  error: unknown,
  options: HandleGlobalErrorOptions = {}
): void {
  if (shouldFailBuild(options)) {
    throw error;
  }

  logFn('error', ZephyrError.format(error));
}
