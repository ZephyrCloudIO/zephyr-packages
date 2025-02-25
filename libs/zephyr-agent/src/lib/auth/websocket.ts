import { io as socketio, type Socket } from 'socket.io-client';

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
export function createSocket(
  endpoint: string
): Socket<ServerToClientEvents, ClientToServerEvents> {
  // Set forceNew to ensure a clean connection
  return socketio(endpoint, {
    forceNew: true,
    reconnection: false,
  });
}
