import { logFn } from '../logging/ze-log-event';
import { ZephyrError } from './zephyr-error';

export interface HandleGlobalErrorOptions {
  /**
   * Rethrow the error so the build fails. When set, it takes precedence over the
   * `ZE_FAIL_BUILD` environment variable.
   */
  failBuild?: boolean;
}

/**
 * Handles errors globally by either throwing them or logging them and allowing execution
 * to continue.
 *
 * @param error - The error to handle
 * @param options - `failBuild` overrides the `ZE_FAIL_BUILD` environment variable
 * @throws The error if `failBuild` is true, or if it is unset and `ZE_FAIL_BUILD=true`
 */
export function handleGlobalError(
  error: unknown,
  options: HandleGlobalErrorOptions = {}
): void {
  if (options.failBuild ?? process.env['ZE_FAIL_BUILD'] === 'true') {
    throw error;
  }

  logFn('error', ZephyrError.format(error));
}
