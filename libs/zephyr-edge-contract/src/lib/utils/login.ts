import * as open from 'open';
import * as jose from 'jose';
import { v4 as uuidv4 } from 'uuid';

import { createSocket, disposeSocket } from './websocket';
import { removeToken, getToken, saveToken } from '../node-persist/token';
import {
  v2_api_paths,
  ZEPHYR_API_ENDPOINT,
} from '../api-contract-negotiation/get-api-contract';

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
    const authUrl = await getAuthenticationURL({ state: sessionKey });
    await open(authUrl);
  }
  return await subscribeToWsEvents(sessionKey);
}

export interface AuthOptions {
  state: string;
  responseType?: string;
  scope?: string;
}

export async function getAuthenticationURL(
  options: AuthOptions,
): Promise<string> {
  const { state } = options;
  const loginUrl = new URL(v2_api_paths.authorize_link, ZEPHYR_API_ENDPOINT);
  loginUrl.searchParams.append('state', state);

  return fetch(loginUrl.href).then((res) => res.text());
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
      console.log('[zephyr] You are already logged in');
      return token;
    }
    await removeToken();
  }

  // No valid token found; initiate authentication.
  const newToken = await authenticateUser();
  console.log('[zephyr] You are logged in');

  return newToken;
}

/**
 * Decides whether the token is still valid based on its expiration time.
 * @param token The token to check.
 * @return boolean indicating if the token is still valid.
 */
export function isTokenStillValid(token: string): boolean {
  const decodedToken = jose.decodeJwt(token);

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
    const socket = createSocket(ZEPHYR_API_ENDPOINT);

    const cleanup = () => disposeSocket(socket);

    socket.on('connect', () => {
      // console.debug('WS Connected');
    });

    socket.on('disconnect', () => cleanup());

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
