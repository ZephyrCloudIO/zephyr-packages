import * as open from 'open';
import { v4 as uuidv4 } from 'uuid';
import { jwtDecode } from 'jwt-decode';

import { createSocket, disposeSocket } from './websocket';
import { getToken, saveToken, clearAll } from './token';
import { environment } from './environment';

export function generateSessionKey(): string {
  return uuidv4().replace(/-/g, '');
}

export interface GetPersonalAccessTokenFromWebsocketOptions {
  openBrowser?: boolean;
}

export async function getPersonalAccessTokenFromWebsocket(
  { openBrowser }: GetPersonalAccessTokenFromWebsocketOptions = {
    openBrowser: true,
  },
): Promise<string> {
  const sessionKey = generateSessionKey();
  if (openBrowser) {
    const authUrl = getAuthenticationURL({ state: sessionKey });
    await open(authUrl);
  }
  return await subscribeToWsEvents(sessionKey);
}

export interface AuthOptions {
  state: string;
  responseType?: string;
  scope?: string;
}

export function getAuthenticationURL(options: AuthOptions): string {
  const { state } = options;

  const auth0RedirectUrl = new URL(
    'authorize',
    environment.ZEPHYR_API_ENDPOINT,
  );

  const loginUrl = new URL('v2/auth/login', environment.ZEPHYR_API_ENDPOINT);
  loginUrl.searchParams.append('state', state);
  loginUrl.searchParams.append('redirect-url', auth0RedirectUrl.href);

  return loginUrl.href;
}
/**
 * Check if the user is already authenticated. If not, open a browser window to authenticate.
 * Display a message to the console.
 * @return The token as a string.
 */
export async function checkAuth(): Promise<string> {
  const token = await getToken();

  if (token) {
    // Check if the token has a valid expiration date.
    if (isTokenStillValid(token)) {
      console.log('\u2714 You are already logged in'); // Check mark symbol.
      return token;
    }
    await clearAll();
  }

  // No valid token found; initiate authentication.
  const newToken = await authenticateUser();
  console.log('\u2705 You are logged in'); // White check mark with green outline.

  return newToken;
}

/**
 * Decides whether the token is still valid based on its expiration time.
 * @param token The token to check.
 * @return boolean indicating if the token is still valid.
 */
export function isTokenStillValid(token: string): boolean {
  const decodedToken = jwtDecode(token);

  if (!decodedToken.exp) {
    return false;
  }

  return new Date(decodedToken.exp * 1000) > new Date();
}

/**
 * Initiates user authentication and handles token storage.
 * @return The new token as a string.
 */
async function authenticateUser(): Promise<string> {
  const token = await getPersonalAccessTokenFromWebsocket();
  await saveToken(token);
  return token;
}

function subscribeToWsEvents(sessionKey: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const socket = createSocket(environment.ZEPHYR_API_ENDPOINT);

    const cleanup = () => {
      disposeSocket(socket);
    };

    socket.on('connect', () => {
      // console.debug('WS Connected');
    });

    socket.on('disconnect', () => {
      // console.debug('WS Disconnected');
      cleanup();
    });

    const roomSocket = socket.emit('joinAccessTokenRoom', {
      state: sessionKey,
    });

    roomSocket.on('access-token', (token) => {
      cleanup();
      resolve(token);
    });

    roomSocket.on('access-token-error', (msg) => {
      console.error('ERROR:', msg);
      cleanup();
      reject(new Error(msg));
    });
  });
}
