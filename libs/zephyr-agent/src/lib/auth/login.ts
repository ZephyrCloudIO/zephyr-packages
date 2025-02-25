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
import { bgBlue, blue, green, red, white, yellow } from '../logging/picocolor';
import { ZeHttpRequest } from '../http/ze-http-request';
import { ZeErrors, ZephyrError } from '../errors';
import {
  DEFAULT_AUTH_COMPLETION_TIMEOUT_MS,
  AuthAction,
  TOKEN_EXPIRY,
} from './auth-flags';

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
  console.log(
    `\n${yellow('Authentication required')} - You need to log in to Zephyr Cloud`
  );

  // Get authentication URL first
  const sessionKey = generateSessionKey();
  const authUrl = await getAuthenticationURL(sessionKey);

  // Prompt user with three options
  const authAction = await promptForAuthAction();

  if (authAction === 'cancel') {
    // User wants to cancel the build
    throw new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
      message: 'Authentication cancelled by user.',
    });
  }

  // Handle browser opening based on user choice
  if (authAction === 'open') {
    try {
      await openUrl(authUrl);
      console.log(`\n${blue('⏳')} Waiting for authentication...\n`);
    } catch (error) {
      // If browser failed to open, fall back to manual
      displayManualLoginInstructions(authUrl);
    }
  } else if (authAction === 'manual') {
    // User wants to manually open the URL
    displayManualLoginInstructions(authUrl);
  }

  // Wait for token regardless of method
  const newToken = await waitForAccessToken(sessionKey);
  await saveToken(newToken);

  console.log(`${green('✓')} You are now logged in to Zephyr Cloud`);

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

/**
 * Prompts the user to choose an authentication action
 *
 * @returns The user's choice: 'open', 'manual', or 'cancel'
 */
async function promptForAuthAction(): Promise<AuthAction> {
  // First display the authentication options
  console.log(`
${yellow('Zephyr Cloud requires authentication to continue')}
`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<AuthAction>((resolve) => {
    console.log(`Options:
${green('y')} - Open browser automatically to log in
${yellow('m')} - Show the login URL (manual login)
${red('n')} - Cancel and exit
`);

    rl.question(`How would you like to proceed? ${green('(Y/m/n)')} `, (answer) => {
      rl.close();

      const normalizedAnswer = answer.trim().toLowerCase();

      if (normalizedAnswer === 'n' || normalizedAnswer === 'no') {
        resolve('cancel');
      } else if (normalizedAnswer === 'm' || normalizedAnswer === 'manual') {
        resolve('manual');
      } else {
        // Default to opening browser for any other input (including empty)
        resolve('open');
      }
    });
  });
}

/** Helper to display manual login instructions with highlighted URL */
function displayManualLoginInstructions(url: string): void {
  console.log(`
${yellow('Please open this URL in your browser to log in:')}

${bgBlue(` ${white(url)} `)}

${blue('⏳')} Waiting for you to complete authentication in browser...
`);
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
