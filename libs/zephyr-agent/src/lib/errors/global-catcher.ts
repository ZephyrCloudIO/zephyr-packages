import { logFn } from '../logging/ze-log-event';
import { ZephyrError } from './zephyr-error';

/**
 * Wraps async function with error handling, logs errors automatically. Set
 * ZE_FAIL_BUILD=true to throw errors instead of logging and returning fallback.
 */
export async function catchAsync<T>(
  fn: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    if (process.env['ZE_FAIL_BUILD'] === 'true') {
      throw error;
    }

    logFn('error', ZephyrError.format(error));

    return fallback;
  }
}
