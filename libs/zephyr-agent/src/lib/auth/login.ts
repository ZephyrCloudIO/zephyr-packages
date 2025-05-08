import * as jose from 'jose';
import * as readline from 'node:readline';
import {
  PromiseWithResolvers,
  ZEPHYR_API_ENDPOINT,
  ZE_API_ENDPOINT,
  ze_api_gateway,
} from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { ZeHttpRequest } from '../http/ze-http-request';
import { ze_log } from '../logging';
import { blue, bold, gray, green, isTTY, white, yellow } from '../logging/picocolor';
import { formatLogMsg, logFn } from '../logging/ze-log-event';
import { getSecretToken } from '../node-persist/secret-token';
import { StorageKeys } from '../node-persist/storage-keys';
import {
  getToken,
  removeToken,
  saveToken,
  isAuthInProgress,
  setAuthInProgressLock,
  removeAuthInProgressLock,
  waitForAuthToComplete,
} from '../node-persist/token';
import { DEFAULT_AUTH_COMPLETION_TIMEOUT_MS, TOKEN_EXPIRY } from './auth-flags';
import { createSocket } from './websocket';

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

  // In non-TTY environments it's expected that a ZE_SECRET_TOKEN is present
  // since user cannot interact with it.
  if (!isTTY) {
    logFn('warn', `Could not load ${StorageKeys.ze_secret_token}.`);
  }

  // Check if authentication is already in progress in another process
  if (await isAuthInProgress()) {
    logFn(
      '',
      `${yellow('Authentication in progress')} - Waiting for authentication to complete in another process...`
    );

    // Wait for the other process to complete authentication
    const tokenFromOtherProcess = await waitForAuthToComplete();
    if (tokenFromOtherProcess) {
      logFn('', `${green('✓')} Authentication completed by another process\n`);
      return tokenFromOtherProcess;
    }

    // If waiting failed, continue with our own authentication process
    logFn(
      '',
      `${yellow('Authentication timeout')} - Proceeding with authentication in this process`
    );
  }

  // Try to acquire the auth lock
  await setAuthInProgressLock(DEFAULT_AUTH_COMPLETION_TIMEOUT_MS);

  // No valid token found; initiate authentication.
  logFn('', `${yellow('Authentication required')} - You need to log in to Zephyr Cloud`);

  // Get authentication URL first
  const sessionKey = generateSessionKey();
  const authUrl = await getAuthenticationURL(sessionKey);

  const browserController = new AbortController();

  // Tries to open the browser to authenticate the user
  void promptForAuthAction(authUrl, browserController.signal)
    .then(() => openUrl(authUrl))
    .catch(() => fallbackManualLogin(authUrl));

  try {
    const newToken = await waitForAccessToken(sessionKey).finally(() =>
      browserController.abort()
    );

    await saveToken(newToken);

    logFn('', `${green('✓')} You are now logged in to Zephyr Cloud\n`);

    return newToken;
  } catch (error) {
    // If authentication fails, remove the lock so other processes can try
    await removeAuthInProgressLock();
    throw error;
  } finally {
    // Reset the browser opened flag regardless of success or failure
    isAuthBrowserOpened = false;
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
async function promptForAuthAction(
  authUrl: string,
  signal: AbortSignal
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    signal,
  });

  return new Promise<string>((resolve) => {
    rl.question(
      formatLogMsg(`
${authUrl}

${gray(`You can hit ${bold(white('Enter'))} to open it up on your browser.`)}
`),

      { signal },
      resolve
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

// Track if a browser window is already opened for auth
let isAuthBrowserOpened = false;

/** Opens the given URL in the default browser, but only if one isn't already open */
async function openUrl(url: string): Promise<void> {
  if (isAuthBrowserOpened) {
    logFn('debug', 'Auth browser already open, not opening another window');
    return;
  }

  try {
    isAuthBrowserOpened = true;
    // Lazy loads `open` module
    const openModule = (await eval(`import('open')`)) as typeof import('open');
    await openModule.default(url);
  } catch (error) {
    isAuthBrowserOpened = false;
    throw error;
  }
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

  // Helper to properly cleanup socket listeners but don't close it
  // (as we're now reusing sockets)
  const cleanupListeners = () => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }

    socket.removeAllListeners();
  };

  try {
    socket.once('access-token', (token) => {
      cleanupListeners();
      resolve(token);
    });

    // Creating errors outside of the listener closure makes the stack trace point
    // to waitForAccessToken fn instead of socket.io internals event emitter code.
    socket.once('access-token-error', (cause) => {
      cleanupListeners();
      reject(
        new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
          cause,
          message: 'Error getting access token',
        })
      );
    });

    socket.once('connect_error', (cause) => {
      cleanupListeners();
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
      cleanupListeners();
      reject(
        new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
          message: `Authentication timed out. Couldn't receive access token in ${DEFAULT_AUTH_COMPLETION_TIMEOUT_MS / 1000} seconds. Please try again.`,
        })
      );
    }, DEFAULT_AUTH_COMPLETION_TIMEOUT_MS);

    return await promise;
  } catch (error) {
    throw error;
  } finally {
    cleanupListeners();
  }
}
