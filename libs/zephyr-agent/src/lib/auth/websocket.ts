import { io as socketio, type Socket } from 'socket.io-client';

interface ClientToServerEvents {
  joinAccessTokenRoom: (props: { state: string }) => void;
}

interface ServerToClientEvents {
  'access-token': (token: string) => void;
  'access-token-error': (msg: string) => void;
}

export class WebSocketManager {
  private static instance: WebSocketManager;
  private activeSocket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private lastConnectionAttempt = 0;
  private readonly COOLDOWN_PERIOD = 5000; // 5 seconds

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  hasActiveConnection(): boolean {
    return this.activeSocket?.connected ?? false;
  }

  canCreateNewConnection(): boolean {
    const now = Date.now();
    return (
      !this.hasActiveConnection() &&
      now - this.lastConnectionAttempt > this.COOLDOWN_PERIOD
    );
  }

  createSocket(endpoint: string): Socket<ServerToClientEvents, ClientToServerEvents> {
    this.lastConnectionAttempt = Date.now();

    if (this.hasActiveConnection()) {
      return this.activeSocket!;
    }

    this.activeSocket = socketio(endpoint, {
      forceNew: true,
      reconnection: false,
      withCredentials: true,
    });

    this.activeSocket.on('disconnect', () => {
      this.activeSocket = null;
    });

    return this.activeSocket;
  }

  cleanup() {
    if (this.activeSocket) {
      this.activeSocket.removeAllListeners();
      this.activeSocket.disconnect();
      this.activeSocket.close();
      this.activeSocket = null;
    }
  }
}

export function createSocket(
  endpoint: string
): Socket<ServerToClientEvents, ClientToServerEvents> {
  return WebSocketManager.getInstance().createSocket(endpoint);
}
