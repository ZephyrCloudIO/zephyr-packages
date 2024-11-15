import * as jose from 'jose';
import {
  PromiseWithResolvers,
  ZE_API_ENDPOINT,
  ze_api_gateway,
  ZEPHYR_API_ENDPOINT,
} from 'zephyr-edge-contract';
import { logFn } from '../logging/ze-log-event';
import { createSocket } from './websocket';
import { getSecretToken } from '../node-persist/secret-token';
import { getToken, removeToken, saveToken } from '../node-persist/token';
import { ze_log } from '../logging';
import { white } from '../logging/picocolor';
import { ZeHttpRequest } from '../http/ze-http-request';
import { ZeErrors, ZephyrError } from '../errors';

/**
 * Check if the user is already authenticated. If not, open a browser window to
 * authenticate. Display a message to the console.
 *
 * @returns The token as a string.
 */
export async function checkAuth(): Promise<string> {
  const secret_token = getSecretToken();

  if (secret_token) {
    return secret_token;
  }

  const token = await getToken();

  if (token) {
    // Check if the token has a valid expiration date.
    if (isTokenStillValid(token, 60)) {
      ze_log('You are already logged in');
      return token;
    }

    await removeToken();
  }

  // No valid token found; initiate authentication.
  const newToken = await authenticateUser();

  ze_log('You are logged in');

  return newToken;
}

/**
 * Decides whether the token is still valid based on its expiration time.
 *
 * @param token The token to check.
 * @param gap In seconds
 * @returns Boolean indicating if the token is still valid.
 */
export function isTokenStillValid(token: string, gap = 0): boolean {
  // Attempts to decode the token
  try {
    const decodedToken = jose.decodeJwt(token);

    if (decodedToken.exp) {
      return new Date(decodedToken.exp * 1000) > new Date(Date.now() + gap * 1000);
    }

    // No expiration date found, invalid token.
    return false;
  } catch {
    // If the token is invalid, return false.
    return false;
  }
}

/** Opens the given URL in the default browser. */
async function openUrl(url: string): Promise<void> {
  // Lazy loads `open` module
  const openModule = (await eval(`import('open')`)) as typeof import('open');
  await openModule.default(url);
}

/** Generates a URL-safe random string to use as a session key. */
function generateSessionKey(): string {
  return encodeURIComponent(
    Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
  );
}

/** Tries to log in the user and get back the websocket reply containing the access token. */
async function getPersonalAccessTokenFromWebsocket(): Promise<string> {
  const sessionKey = generateSessionKey();

  // Attempts to open the browser to authenticate the user.
  const authUrl = await getAuthenticationURL(sessionKey);

  try {
    await openUrl(authUrl);
    logFn('debug', 'Opening browser for authentication...');
  } catch (error) {
    ze_log(error);
    logFn(
      'debug',
      `Could not open browser to authenticate with ZephyrCloud. Please open the link below to authenticate:\n\n${white(authUrl)}\n`
    );
  }

  return await waitForAccessToken(sessionKey);
}

/** Generates the URL to authenticate the user. */
async function getAuthenticationURL(state: string): Promise<string> {
  const [ok, cause, data] = await ZeHttpRequest.from<string>({
    path: ze_api_gateway.auth_link,
    base: ZE_API_ENDPOINT(),
    query: { state },
  });

  if (!ok) {
    throw new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
      cause,
      message: 'Could not get authentication URL',
    });
  }

  return data;
}

/**
 * Initiates user authentication and handles token storage.
 *
 * @returns The new token as a string.
 */
async function authenticateUser(): Promise<string> {
  const token = await getPersonalAccessTokenFromWebsocket();
  await saveToken(token);
  return token;
}

/** Waits for the access token to be received from the websocket. */
async function waitForAccessToken(sessionKey: string): Promise<string> {
  const { promise, resolve, reject } = PromiseWithResolvers<string>();
  const socket = createSocket(ZEPHYR_API_ENDPOINT());

  try {
    socket.once('access-token', resolve);
    // Creating errors outside of the listener closure makes the stack trace point
    // to waitForAccessToken fn instead of socket.io internals event emitter code.
    socket.once('access-token-error', (cause) =>
      reject(
        new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
          cause,
          message: 'Error getting access token',
        })
      )
    );
    socket.once('connect_error', (cause) =>
      reject(
        new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
          message: 'Could not connect to socket.',
          cause,
        })
      )
    );

    socket.emit('joinAccessTokenRoom', { state: sessionKey });

    // The user has 60 seconds to log in through the browser.
    setTimeout(
      reject,
      60_000,
      new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
        message: "Couldn't receive access token in 1 minute.",
      })
    );

    return await promise;
  } finally {
    socket.close();
  }
}
