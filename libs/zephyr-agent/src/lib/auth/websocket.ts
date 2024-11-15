import { io as socketio, type Socket } from 'socket.io-client';

interface ClientToServerEvents {
  joinAccessTokenRoom: (props: { state: string }) => void;
}

interface ServerToClientEvents {
  'access-token': (token: string) => void;
  'access-token-error': (msg: string) => void;
}

export function createSocket(
  endpoint: string
): Socket<ServerToClientEvents, ClientToServerEvents> {
  return socketio(endpoint);
}
