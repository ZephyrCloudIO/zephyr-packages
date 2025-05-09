import * as jose from 'jose';
import * as readline from 'node:readline';
import * as crypto from 'node:crypto';
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
import {
  getToken,
  removeToken,
  saveToken,
  fixAuthTokenStorage,
} from '../node-persist/token';
import { DEFAULT_AUTH_COMPLETION_TIMEOUT_MS, TOKEN_EXPIRY } from './auth-flags';
import { WebSocketManager } from './websocket';
import { once } from 'node:events';
/**
 * Check if the user is already authenticated. If not, ask if they want to open a browser
 * to authenticate. Display a message to the console.
 *
 * @returns The token as a string.
 */
export async function checkAuth(): Promise<string> {
  const socketManager = WebSocketManager.getInstance();
  const secret_token = getSecretToken();

  if (secret_token) {
    logFn('debug', 'Token found in environment. Using secret token for authentication.');
    return secret_token;
  }

  // Attempt to get the token, and if that fails due to corruption, try to repair and retry
  let existingToken: string | undefined;
  try {
    existingToken = await getToken();
  } catch (error) {
    // If we get an error trying to read the token, attempt to repair the storage file
    ze_log('warn', 'Error reading auth token, attempting to repair storage file', error);
    const repaired = await fixAuthTokenStorage();
    if (repaired) {
      // Try again after repair
      try {
        existingToken = await getToken();
      } catch (retryError) {
        ze_log('error', 'Still unable to read token after repair', retryError);
      }
    }
  }

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

  // Check if auth process is already in progress
  if (socketManager.isAuthInProgress()) {
    logFn('debug', 'Authentication already in progress. Waiting for it to complete...');
    // Wait for a bit before checking if the token is already available
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check again for an existing token that may have been shared by another process
    const token = await getToken();
    if (token && isTokenStillValid(token, TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC)) {
      return token;
    }
  }

  // Mark that auth process is starting
  socketManager.setAuthInProgress(true);

  // Tries to open the browser to authenticate the user
  void promptForAuthAction(authUrl, browserController.signal)
    .then(() => {
      ze_log('promptForAuthAction: Browser opened');
      openUrl(authUrl)
        .then(() => {
          ze_log('openUrl: Browser opened');
        })
        .catch((err) => {
          console.error(err);
          fallbackManualLogin(authUrl);
        });
    })
    .catch((err) => {
      ze_log('promptForAuthAction: Error opening browser', err);
      fallbackManualLogin(authUrl);
      throw new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
        cause: err,
        message: 'Error opening browser',
      });
    });

  try {
    // Wait for either the token or the auth process to complete
    const newTokenOrAbort = await Promise.race([
      waitForAccessToken(sessionKey),
      new Promise<string>((resolve) => {
        ze_log('Promise.race: Waiting for browser controller to abort...');
        once(browserController.signal, 'abort')
          .then(async () => {
            const token = await getToken();
            if (token) {
              ze_log('Promise.race: Token found, resolving...');
              resolve(token);
            }
          })
          .catch((err) => {
            ze_log('Promise.race: Error waiting for browser controller to abort', err);
            console.error(err);
            // don't throw here - it might pass
          });
      }),
    ]).finally(() => {
      ze_log('Promise.race: Abort event received, aborting browser controller...');
      browserController.abort();
    });

    if (typeof newTokenOrAbort === 'string' && newTokenOrAbort) {
      await saveToken(newTokenOrAbort);

      // At this point, the WebSocketManager will automatically share the token
      // with other processes via the shared room mechanism
      logFn('', `${green('✓')} You are now logged in to Zephyr Cloud\n`);

      return newTokenOrAbort;
    }

    ze_log('Promise.race: Abort event received, returning null...');
    throw new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
      message: 'Abort event received',
    });
  } catch (error) {
    ze_log('Promise.race: Error in authentication flow');
    throw new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
      cause: error,
      message: 'Error waiting for access token',
    });
  } finally {
    socketManager.setAuthInProgress(false);
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
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const openModule = (await eval(`import('open')`)) as typeof import('open');
  await openModule.default(url);
}

/** Generates a URL-safe random string to use as a session key. */
function generateSessionKey(): string {
  return Buffer.from(crypto.randomBytes(16)).toString('base64url');
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

  // Check if token already exists from another process
  const existingToken = await getToken();
  if (
    existingToken &&
    isTokenStillValid(existingToken, TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC)
  ) {
    ze_log('Found valid token in storage, using it');
    socketManager.setAuthInProgress(false);
    return existingToken;
  }

  if (!socketManager.canCreateNewConnection()) {
    // If there's an active connection, wait for it to be closed before creating a new one
    ze_log('Waiting for existing authentication to complete...');
    // Wait for 10 seconds before checking if the token is still valid
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const token = await getToken();
    if (token && isTokenStillValid(token, TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC)) {
      ze_log('Token is still valid, aborting browser controller');
      socketManager.setAuthInProgress(false);
      return token;
    }
    ze_log('Token is not valid, prompting for auth action');

    return await checkAuth();
  }

  try {
    // Use the requestAccessToken method from WebSocketManager, which now handles shared auth
    const token = await socketManager.requestAccessToken(
      ZEPHYR_API_ENDPOINT(),
      sessionKey,
      DEFAULT_AUTH_COMPLETION_TIMEOUT_MS
    );

    // Save the token - either this process got it directly or received it from another process
    await saveToken(token);
    return token;
  } finally {
    // Don't fully clean up the socket as we want to keep it alive for cross-process communication
    socketManager.cleanupTimeout();
    socketManager.setAuthInProgress(false);
  }
}
