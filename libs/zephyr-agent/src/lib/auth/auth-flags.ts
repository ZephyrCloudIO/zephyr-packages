/** Constants and helpers for authentication configuration */

/** Default timeout for authentication prompt in milliseconds */
export const DEFAULT_AUTH_PROMPT_TIMEOUT_MS = 10000; // 10 seconds

/** Default timeout for authentication completion in milliseconds */
export const DEFAULT_AUTH_COMPLETION_TIMEOUT_MS = 60000; // 1 minute

/** Authentication action types returned from the prompt */
export type AuthAction = 'open' | 'manual' | 'cancel';

/** Token expiration thresholds */
export const TOKEN_EXPIRY = {
  /**
   * Short validity check (in seconds) Used to determine if a token is still valid for
   * immediate use
   */
  SHORT_VALIDITY_CHECK_SEC: 60, // 1 minute buffer

  /**
   * Proactive refresh threshold (in seconds) If token will expire within this time,
   * proactively refresh it
   */
  PROACTIVE_REFRESH_THRESHOLD_SEC: 24 * 60 * 60, // 24 hours
};