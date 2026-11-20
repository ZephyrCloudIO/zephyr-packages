/** Which Zephyr client is logging in; the login confirmation page names it to the user. */
export type ZeAuthOrigin = 'cli' | 'plugin';

let authOrigin: ZeAuthOrigin = 'plugin';

/**
 * Declares which Zephyr client this process is. The Zephyr CLI calls this once at
 * startup; bundler plugins keep the default.
 */
export function setAuthOrigin(origin: ZeAuthOrigin): void {
  authOrigin = origin;
}

export function getAuthOrigin(): ZeAuthOrigin {
  return authOrigin;
}
