import * as jose from 'jose';
import * as readline from 'node:readline';
import {
  PromiseWithResolvers,
  ZEPHYR_API_ENDPOINT,
  ZE_API_ENDPOINT,
  ze_api_gateway,
} from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { makeRequest } from '../http/http-request';
import { ze_log } from '../logging';
import { blue, bold, gray, green, isTTY, white, yellow } from '../logging/picocolor';
import { formatLogMsg, logFn } from '../logging/ze-log-event';
import { getSecretToken } from '../node-persist/secret-token';
import { StorageKeys } from '../node-persist/storage-keys';
import { getToken, removeToken, saveToken } from '../node-persist/token';
import { DEFAULT_AUTH_COMPLETION_TIMEOUT_MS, TOKEN_EXPIRY } from './auth-flags';
import { createSocket } from './websocket';
import { getSessionKey, waitForUnlock } from '../node-persist/session-lock';

/**
 * Check if the user is already authenticated. If not, ask if they want to open a browser
 * to authenticate. Display a message to the console.
 *
 * @returns The token as a string.
 */
export async function checkAuth(): Promise<void> {
  const secret_token = getSecretToken();

  if (secret_token) {
    logFn('debug', 'Token found in environment. Using secret token for authentication.');
    return;
  }

  const existingToken = await getToken();

  if (existingToken) {
    // Check if the token has a valid expiration date.
    if (isTokenStillValid(existingToken, TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC)) {
      ze_log('You are already logged in');
      return;
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
  using sessionKey = getSessionKey();
  const authUrl = await getAuthenticationURL(sessionKey.session);

  if (!sessionKey.owner) {
    logFn('', gray('Waiting for session unlock...'));
  }

  const browserController = new AbortController();

  // Tries to open the browser to authenticate the user
  void promptForAuthAction(authUrl, browserController.signal)
    .then(() => openUrl(authUrl))
    .catch(() => fallbackManualLogin(authUrl));

  // We are the owner of the session request, join websocket room
  // and wait for the access token
  if (sessionKey.owner) {
    const newToken = await waitForAccessToken(sessionKey.session).finally(() =>
      browserController.abort()
    );

    await saveToken(newToken);
  } else {
    // node-persist is not concurrent safe, so we need to wait for the unlock
    // before next readToken() calls can happen
    // https://github.com/simonlast/node-persist/issues/108#issuecomment-1442305246
    await waitForUnlock(browserController.signal);

    const token = await getToken();

    // Unlock also happens on timeout, so we need to check if the token was
    // actually saved or not
    if (!token) {
      throw new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
        message: 'No token found after authentication finished, did it timeout?',
      });
    }
  }

  logFn('', `${green('✓')} You are now logged in to Zephyr Cloud\n`);
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

/** Generates the URL to authenticate the user. */
async function getAuthenticationURL(state: string): Promise<string> {
  const [ok, cause, data] = await makeRequest<string>({
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
  } finally {
    cleanupSocket();
  }
}
