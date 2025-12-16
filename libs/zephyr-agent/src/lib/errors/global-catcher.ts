import { logFn } from '../logging/ze-log-event';
import { ZephyrError } from './zephyr-error';

/**
 * Handles errors globally by either throwing them (if ZE_FAIL_BUILD=true) or logging them
 * and allowing execution to continue.
 *
 * @param error - The error to handle
 * @throws The error if ZE_FAIL_BUILD environment variable is set to 'true'
 */
export function handleGlobalError(error: unknown): void {
  if (process.env['ZE_FAIL_BUILD'] === 'true') {
    throw error;
  }

  logFn('error', ZephyrError.format(error));
}
