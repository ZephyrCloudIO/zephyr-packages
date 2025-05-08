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
  cleanStaleAuthLock,
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

  // Check for and clean up any stale authentication locks before proceeding
  await cleanStaleAuthLock();

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

  // Try to acquire the auth lock with exponential backoff
  const maxRetries = 5;
  let retryCount = 0;
  let hasLock = false;

  // Attempt to get the lock with exponential backoff
  while (!hasLock && retryCount < maxRetries) {
    hasLock = await setAuthInProgressLock(DEFAULT_AUTH_COMPLETION_TIMEOUT_MS);

    if (!hasLock) {
      // Another process got the lock first, wait a bit with exponential backoff
      const waitTime = Math.min(100 * Math.pow(2, retryCount), 2000); // Start with 100ms, max 2s
      logFn(
        'debug',
        `Another process acquired the lock. Retry ${retryCount + 1}/${maxRetries} in ${waitTime}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      retryCount++;

      // Check if auth completed during our wait
      const token = await getToken();
      if (token && isTokenStillValid(token, TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC)) {
        logFn(
          '',
          `${green('✓')} Authentication completed by another process during retry wait\n`
        );
        return token;
      }
    }
  }

  // If we couldn't get the lock after retries, wait for the existing authentication process
  if (!hasLock) {
    logFn(
      '',
      `${yellow('Could not acquire auth lock')} - Waiting for existing authentication to complete...`
    );
    const tokenFromOtherProcess = await waitForAuthToComplete(180000); // Wait longer (3 minutes)
    if (tokenFromOtherProcess) {
      logFn('', `${green('✓')} Authentication completed by another process\n`);
      return tokenFromOtherProcess;
    }

    // If still no luck, try one last time to acquire the lock
    hasLock = await setAuthInProgressLock(DEFAULT_AUTH_COMPLETION_TIMEOUT_MS);
    if (!hasLock) {
      throw new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
        message:
          'Could not acquire authentication lock after multiple retries. Try again later or use ZE_SECRET_TOKEN environment variable.',
      });
    }
  }

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
    // Check for a token before we even start the login process
    // This is a last safety check in case another process completed auth
    // between our last check and now
    const existingToken = await getToken();
    if (
      existingToken &&
      isTokenStillValid(existingToken, TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC)
    ) {
      logFn(
        'debug',
        'Found valid token from another process before starting our own auth'
      );
      browserController.abort(); // Don't open browser
      return existingToken;
    }

    try {
      const newToken = await waitForAccessToken(sessionKey).finally(() =>
        browserController.abort()
      );

      await saveToken(newToken);
      logFn('', `${green('✓')} You are now logged in to Zephyr Cloud\n`);
      return newToken;
    } catch (error) {
      // Check one more time if a token has appeared while we were trying to authenticate
      // This can happen if multiple processes were authenticating simultaneously
      const lastChanceToken = await getToken();
      if (
        lastChanceToken &&
        isTokenStillValid(lastChanceToken, TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC)
      ) {
        logFn(
          'debug',
          'Found valid token from another process after our auth attempt failed'
        );
        return lastChanceToken;
      }

      // If we still don't have a token, rethrow the original error
      throw error;
    }
  } finally {
    // Reset the browser opened flag regardless of success or failure
    await removeAuthInProgressLock();
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
  let checkTokenIntervalId: NodeJS.Timeout | null = null;

  // Add a shorter interval to periodically check if another process obtained a token
  const checkForExistingToken = async () => {
    try {
      const existingToken = await getToken();
      if (
        existingToken &&
        isTokenStillValid(existingToken, TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC)
      ) {
        logFn('debug', 'Found valid token from another process during socket wait');
        cleanupListeners();
        resolve(existingToken);
      }
    } catch {
      // Ignore errors during token check
    }
  };

  // Helper to properly cleanup socket listeners but don't close it
  // (as we're now reusing sockets)
  const cleanupListeners = () => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }

    if (checkTokenIntervalId) {
      clearInterval(checkTokenIntervalId);
      checkTokenIntervalId = null;
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

    // Start checking periodically for tokens from other processes
    checkTokenIntervalId = setInterval(checkForExistingToken, 2000); // Check every 2 seconds

    // Also check immediately
    void checkForExistingToken();

    // The user has a specified amount of time to log in through the browser.
    timeoutHandle = setTimeout(() => {
      // One final check for token before timing out
      getToken()
        .then((token) => {
          if (token && isTokenStillValid(token, TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC)) {
            cleanupListeners();
            resolve(token);
          } else {
            cleanupListeners();
            reject(
              new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
                message: `Authentication timed out. Couldn't receive access token in ${DEFAULT_AUTH_COMPLETION_TIMEOUT_MS / 1000} seconds. Please try again.`,
              })
            );
          }
        })
        .catch(() => {
          cleanupListeners();
          reject(
            new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
              message: `Authentication timed out. Couldn't receive access token in ${DEFAULT_AUTH_COMPLETION_TIMEOUT_MS / 1000} seconds. Please try again.`,
            })
          );
        });
    }, DEFAULT_AUTH_COMPLETION_TIMEOUT_MS);

    return await promise;
  } finally {
    cleanupListeners();
  }
}
