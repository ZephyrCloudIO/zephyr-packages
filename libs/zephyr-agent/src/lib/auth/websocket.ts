import { io as socketio, type Socket } from 'socket.io-client';
import { WebSocket } from 'undici';

import { ze_debug, ze_error } from '../logging';

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

export function createSocket(endpoint: URL): WebSocket {
  // endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
  // endpoint.port = endpoint.port === '443' ? '80' : endpoint.port;
  endpoint.hostname = 'auth.zephyr.local';
  try {
    ze_debug('createSocket', `Creating socket: ${endpoint}`);
    const socket = new WebSocket(endpoint);
    ze_debug('createSocket', `Socket created: ${socket.readyState}`);

    socket.addEventListener('error', (event) => {
      ze_error('createSocket', `Error: ${event.message}`);
    });

    socket.addEventListener('open', () => {
      ze_debug('createSocket', `Socket opened: ${socket.readyState}`);
    });

    socket.addEventListener('close', () => {
      ze_debug('createSocket', `Socket closed: ${socket.readyState}`);
    });

    return socket;
  } catch (error) {
    ze_error('createSocket', `Error creating socket: ${error}`);
    throw error;
  }
}
