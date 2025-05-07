import { io as socketio, type Socket } from 'socket.io-client';

interface ClientToServerEvents {
  joinAccessTokenRoom: (props: { state: string }) => void;
}

interface ServerToClientEvents {
  'access-token': (token: string) => void;
  'access-token-error': (msg: string) => void;
}

// Store a reference to the active socket for reuse
let activeSocket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
let activeEndpoint: string | null = null;

/**
 * Creates a socket.io connection to the specified endpoint If a connection already exists
 * to the same endpoint, it is reused
 *
 * @param endpoint The endpoint to connect to
 * @returns A socket.io Socket instance
 */
export function createSocket(
  endpoint: string
): Socket<ServerToClientEvents, ClientToServerEvents> {
  // If we already have an active socket for this endpoint, return it
  if (activeSocket && activeEndpoint === endpoint && activeSocket.connected) {
    return activeSocket;
  }

  // Otherwise create a new connection
  activeEndpoint = endpoint;
  activeSocket = socketio(endpoint, {
    forceNew: true,
    reconnection: false,
    withCredentials: true,
  });

  return activeSocket;
}

/** Closes the active socket connection if one exists */
export function closeSocket(): void {
  if (activeSocket) {
    activeSocket.removeAllListeners();
    activeSocket.disconnect();
    activeSocket.close();
    activeSocket = null;
    activeEndpoint = null;
  }
}
