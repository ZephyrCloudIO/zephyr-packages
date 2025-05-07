import * as jose from 'jose';
import * as readline from 'node:readline';
import {
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
import { getToken, removeToken, saveToken } from '../node-persist/token';
import { DEFAULT_AUTH_COMPLETION_TIMEOUT_MS, TOKEN_EXPIRY } from './auth-flags';
import { WebSocketManager } from './websocket';
import { PollingManager } from './polling-manager';
import { once } from 'node:events';
/**
 * Check if the user is already authenticated. If not, ask if they want to open a browser
 * to authenticate. Display a message to the console.
 *
 * @returns The token as a string.
 */
export async function checkAuth(): Promise<string> {
  const pollingManager = PollingManager.getInstance();
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

  // No valid token found; initiate authentication.
  logFn('', `${yellow('Authentication required')} - You need to log in to Zephyr Cloud`);

  // Get authentication URL first
  const sessionKey = generateSessionKey();
  const authUrl = await getAuthenticationURL(sessionKey);

  const browserController = new AbortController();

  ;
  // Check if auth process is already in progress
  if (pollingManager.isAuthInProgress()) {
    logFn('debug', 'Authentication already in progress. Waiting for it to complete...');
    // Wait for a bit before checking if the token is already available
    await new Promise((resolve) => setTimeout(resolve, 5000));


    if (existingToken && isTokenStillValid(existingToken, TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC)) {
      return existingToken;
    }
  }

  // Mark that auth process is starting
  pollingManager.setAuthInProgress(true);

  // Start polling for valid token
  const pollInterval = pollingManager.startPolling(async () => {
    const token = await getToken();
    if (token && isTokenStillValid(token, TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC)) {
      pollingManager.stopPolling(pollInterval);
      browserController.abort();
    }
  }, 5000);

  // Tries to open the browser to authenticate the user
  void promptForAuthAction(authUrl, browserController.signal)
    .then(() => {
      ze_log('promptForAuthAction: Browser opened, stopping polling...');
      pollingManager.stopPolling(pollInterval);
      openUrl(authUrl);
    })
    .catch((err) => {
      ze_log('promptForAuthAction: Error, stopping polling...', err);
      // Stop the polling interval if there's an error
      pollingManager.stopPolling(pollInterval);
      fallbackManualLogin(authUrl);
      throw new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
        cause: err,
        message: 'Error opening browser',
      });
    }).finally(() => {
      // Stop the polling interval when browser is opened
      pollingManager.stopPolling(pollInterval);
    });

  try {
    // Wait for either the token or the auth process to complete
    const newTokenOrAbort = await Promise.race([
      waitForAccessToken(sessionKey),
      new Promise<string>((resolve) => {
        ze_log('Promise.race: Waiting for browser controller to abort...');
        once(browserController.signal, 'abort').then(async () => {
          const token = await getToken();
          if (token) {
            ze_log('Promise.race: Token found, resolving...');
            resolve(token);
          }
        });
      }),
    ]).finally(() => {
      ze_log('Promise.race: Finally, clearing interval...');
      clearInterval(pollInterval);
      ze_log('Promise.race: Abort event received, aborting browser controller...');
      browserController.abort();
    });

    if (typeof newTokenOrAbort === 'string' && newTokenOrAbort) {
      await saveToken(newTokenOrAbort);

      logFn('', `${green('✓')} You are now logged in to Zephyr Cloud\n`);

      return newTokenOrAbort;
    }

    ze_log('Promise.race: Abort event received, returning null...');
    throw new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
      message: 'Abort event received',
    });
  } catch (error) {
    ze_log('Promise.race: Error, clearing interval...');
    throw new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
      cause: error,
      message: 'Error waiting for access token',
    });
  } finally {
    pollingManager.stopPolling(pollInterval);
    pollingManager.setAuthInProgress(false);
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
  const socketManager = WebSocketManager.getInstance();
  const pollingManager = PollingManager.getInstance();

  if (!socketManager.canCreateNewConnection()) {
    // If there's an active connection, wait for it to be closed before creating a new one
    ze_log('Waiting for existing authentication to complete...');
    // Wait for 10 seconds before checking if the token is still valid
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const token = await getToken();
    if (token && isTokenStillValid(token, TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC)) {
      ze_log('Token is still valid, aborting browser controller');
      pollingManager.setAuthInProgress(false);
      return token;
    }
    ze_log('Token is not valid, prompting for auth action');

    return await checkAuth();
  }

  try {
    // Use the new requestAccessToken method from WebSocketManager
    return await socketManager.requestAccessToken(
      ZEPHYR_API_ENDPOINT(),
      sessionKey,
      DEFAULT_AUTH_COMPLETION_TIMEOUT_MS
    );
  } finally {
    // Cleanup and reset auth progress flag
    socketManager.cleanup();
    pollingManager.setAuthInProgress(false);
  }
}
