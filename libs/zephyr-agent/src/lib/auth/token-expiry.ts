import * as jose from 'jose';

/**
 * Reads a JWT's expiration in epoch milliseconds.
 *
 * Lives outside `login.ts` so credential storage can share it without importing the
 * interactive login flow, which itself depends on token storage.
 *
 * @param token The token to inspect.
 * @returns The expiration, or `undefined` when the token is undecodable or has no `exp`.
 */
export function getTokenExpirationMs(token: string): number | undefined {
  try {
    const { exp } = jose.decodeJwt(token);
    return typeof exp === 'number' ? exp * 1000 : undefined;
  } catch {
    // Not a decodable JWT, so no expiration can be established.
    return undefined;
  }
}

/**
 * Decides whether the token is still valid based on its expiration time.
 *
 * @param token The token to check.
 * @param gap In seconds
 * @returns Boolean indicating if the token is still valid.
 */
export function isTokenStillValid(token: string, gap = 0): boolean {
  const expiresAtMs = getTokenExpirationMs(token);
  // A token without a readable expiration is treated as invalid.
  return expiresAtMs !== undefined && expiresAtMs > Date.now() + gap * 1000;
}
