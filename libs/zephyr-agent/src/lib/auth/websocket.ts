import { io as socketio, type Socket } from 'socket.io-client';
import WebSocket from 'ws';
import axios from 'axios';
import { ze_debug, ze_error } from '../logging';
import { ZeErrors, ZephyrError } from '../errors';

interface ClientToServerEvents {
  joinAccessTokenRoom: (props: { state: string }) => void;
}

interface ServerToClientEvents {
  'access-token': (token: string) => void;
  'access-token-error': (msg: string) => void;
}

/**
 * Creates a new socket.io connection to the specified endpoint
 *
 * @param endpoint The endpoint to connect to
 * @returns A socket.io Socket instance
 */
export function createIoSocket(
  endpoint: string
): Socket<ServerToClientEvents, ClientToServerEvents> {
  // Set forceNew to ensure a clean connection
  return socketio(endpoint, {
    forceNew: true,
    reconnection: false,
    withCredentials: true,
  });
}

export async function createSocket(endpoint: URL): Promise<WebSocket> {
  // Convert to WebSocket URL
  const wsEndpoint = new URL(endpoint);
  wsEndpoint.protocol = wsEndpoint.protocol === 'https:' ? 'wss:' : 'ws:';
  wsEndpoint.pathname = 'websocket';
  wsEndpoint.hostname = 'auth.zephyr.local';

  try {
    ze_debug('createSocket', `Creating socket: ${wsEndpoint}`);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsEndpoint.toString());

      ws.addEventListener('error', (error) => {
        ze_error('createSocket', `Socket error: ${error.message}`);
        reject(error);
      });

      ws.addEventListener('open', () => {
        ze_debug('createSocket', `Socket opened: ${ws.readyState}`);
        resolve(ws);
      });

      ws.addEventListener('close', () => {
        ze_debug('createSocket', `Socket closed: ${ws.readyState}`);
      });
    });
  } catch (error) {
    ze_error('createSocket', `Error creating socket: ${error}`);
    throw error;
  }
}

export async function createSocketCloudflare(endpoint: URL): Promise<WebSocket> {
  // Convert to WebSocket URL
  const wsEndpoint = new URL(endpoint);
  wsEndpoint.hostname = 'auth.zephyr.local';

  try {
    ze_debug('createSocketCloudflare', `Creating socket: ${wsEndpoint}`);

    // Make a fetch request including `Upgrade: websocket` header.
    // The Workers Runtime will automatically handle other requirements
    // of the WebSocket protocol, like the Sec-WebSocket-Key header.
    const resp = await axios.get(wsEndpoint.toString(), {
      headers: {
        upgrade: 'websocket',
      },
    });

    // If the WebSocket handshake completed successfully, then the
    // response has a `webSocket` property.
    const ws = (resp as any).webSocket;
    if (!ws) {
      throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: 'Server did not accept WebSocket',
      });
    }

    // Call accept() to indicate that you'll be handling the socket here
    // in JavaScript, as opposed to returning it on to a client.
    ws.accept();

    return ws;
  } catch (ex) {
    const error = ex as Error;
    ze_error('createSocketCloudflare', `Error creating socket: ${error.message}`);
    throw error;
  }
}
