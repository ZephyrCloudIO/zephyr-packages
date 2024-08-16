import * as jose from 'jose';
import { v4 as uuidv4 } from 'uuid';
import {
  getSecretToken,
  getToken,
  removeToken,
  request,
  saveToken,
  ZE_API_ENDPOINT,
  ze_api_gateway,
  ze_log,
  ZEPHYR_API_ENDPOINT,
} from 'zephyr-edge-contract';
import { createSocket, disposeSocket } from './websocket';

const open = (str: string) =>
  new Function(`return import("open")`)().then(({ default: open }: { default: (str: string) => Promise<void> }) => open(str));

export function generateSessionKey(): string {
  return uuidv4().replace(/-/g, '');
}

export interface GetPersonalAccessTokenFromWebsocketOptions {
  openBrowser?: boolean;
}

export async function getPersonalAccessTokenFromWebsocket(
  { openBrowser }: GetPersonalAccessTokenFromWebsocketOptions = {
    openBrowser: true,
  }
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

export async function getAuthenticationURL(options: AuthOptions): Promise<string> {
  const { state } = options;
  // const loginUrl = new URL('/v2/authorize-link', ZEPHYR_API_ENDPOINT());
  const loginUrl = new URL(ze_api_gateway.auth_link, ZE_API_ENDPOINT());
  loginUrl.searchParams.append('state', state);

  return request(loginUrl);
}

/**
 * Check if the user is already authenticated. If not, open a browser window to authenticate.
 * Display a message to the console.
 * @return The token as a string.
 */
export async function checkAuth(): Promise<string> {
  const secret_token = await getSecretToken();
  if (secret_token) {
    return secret_token;
  }

  const token = await getToken();

  if (token) {
    // Check if the token has a valid expiration date.
    if (isTokenStillValid(token)) {
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
    const socket = createSocket(ZEPHYR_API_ENDPOINT());

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
