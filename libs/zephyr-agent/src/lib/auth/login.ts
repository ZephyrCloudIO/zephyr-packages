import * as jose from 'jose';
import * as readline from 'readline';
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
import { blue, bold, green, white, yellow } from '../logging/picocolor';
import { ZeHttpRequest } from '../http/ze-http-request';
import { ZeErrors, ZephyrError } from '../errors';
import { DEFAULT_AUTH_COMPLETION_TIMEOUT_MS, TOKEN_EXPIRY } from './auth-flags';
import { brightBlueBgName } from '../logging/debug';

/**
 * Check if the user is already authenticated. If not, ask if they want to open a browser
 * to authenticate. Display a message to the console.
 *
 * @returns The token as a string.
 */
export async function checkAuth(): Promise<string> {
  const secret_token = getSecretToken();

  if (secret_token) {
    logFn('debug', 'Token found in environment. Using secret token for authentication.');
    return secret_token;
  }

  const existingToken = await getToken();

  if (existingToken) {
    // Check if the token has a valid expiration date.
    if (isTokenStillValid(existingToken, TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC)) {
      ze_log('You are already logged in');
      return existingToken;
    }

    await removeToken();
  }

  // No valid token found; initiate authentication.
  logFn('', `${yellow('Authentication required')} - You need to log in to Zephyr Cloud`);

  // Get authentication URL first
  const sessionKey = generateSessionKey();
  const authUrl = await getAuthenticationURL(sessionKey);

  // Prompt user to continue
  await promptForAuthAction(authUrl);

  // Handle browser opening
  try {
    await openUrl(authUrl);
    logFn('', `${blue('⏳')} Waiting for authentication...\n`);
  } catch (error) {
    // If browser failed to open, fall back to manual
    fallbackManualLogin(authUrl);
  }

  // Wait for token regardless of method
  const newToken = await waitForAccessToken(sessionKey);
  await saveToken(newToken);

  logFn('', `${green('✓')} You are now logged in to Zephyr Cloud`);

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

/** Prompts the user to choose an authentication action */
async function promptForAuthAction(authUrl: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<void>((resolve) => {
    rl.question(
      `${brightBlueBgName}  This is the authentication URL:
${brightBlueBgName}
${brightBlueBgName}  ${authUrl}
${brightBlueBgName}
${brightBlueBgName}  Please hit ${bold(white('Enter'))} to open it up on your browser: `,
      () => {
        rl.close();
        resolve();
      }
    );
  });
}

/** Helper to display manual login instructions with highlighted URL */
function fallbackManualLogin(url: string): void {
  logFn('', '');
  logFn('', `An unexpected error happened when opening the browser.`);
  logFn('', `${yellow('Please open this URL in your browser to log in:')}`);
  logFn('', url);
  logFn('', `${blue('⏳')} Waiting for you to complete authentication in browser...`);
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
export async function authenticateUser(): Promise<string> {
  return await checkAuth();
}

/** Waits for the access token to be received from the websocket. */
async function waitForAccessToken(sessionKey: string): Promise<string> {
  const { promise, resolve, reject } = PromiseWithResolvers<string>();
  const socket = createSocket(ZEPHYR_API_ENDPOINT());
  let timeoutHandle: NodeJS.Timeout | null = null;

  // Helper to properly cleanup socket
  const cleanupSocket = () => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }

    socket.removeAllListeners();
    socket.disconnect();
    socket.close();
  };

  try {
    socket.once('access-token', (token) => {
      cleanupSocket();
      resolve(token);
    });

    // Creating errors outside of the listener closure makes the stack trace point
    // to waitForAccessToken fn instead of socket.io internals event emitter code.
    socket.once('access-token-error', (cause) => {
      cleanupSocket();
      reject(
        new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
          cause,
          message: 'Error getting access token',
        })
      );
    });

    socket.once('connect_error', (cause) => {
      cleanupSocket();
      reject(
        new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
          message: 'Could not connect to socket.',
          cause,
        })
      );
    });

    socket.emit('joinAccessTokenRoom', { state: sessionKey });

    // The user has a specified amount of time to log in through the browser.
    timeoutHandle = setTimeout(() => {
      cleanupSocket();
      reject(
        new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
          message: `Authentication timed out. Couldn't receive access token in ${DEFAULT_AUTH_COMPLETION_TIMEOUT_MS / 1000} seconds. Please try again.`,
        })
      );
    }, DEFAULT_AUTH_COMPLETION_TIMEOUT_MS);

    return await promise;
  } catch (error) {
    cleanupSocket();
    throw error;
  } finally {
    cleanupSocket();
  }
}
