import { io as socketio, type Socket } from 'socket.io-client';
import { PromiseWithResolvers } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';

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
  private timeoutHandle: NodeJS.Timeout | null = null;

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

    if (this.hasActiveConnection() && this.activeSocket) {
      return this.activeSocket;
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

  /**
   * Requests an access token via WebSocket.
   * @param endpoint The WebSocket endpoint URL
   * @param sessionKey The session key for authentication
   * @param timeoutMs Timeout in milliseconds
   * @returns A promise that resolves with the access token
   */
  async requestAccessToken(
    endpoint: string, 
    sessionKey: string, 
    timeoutMs: number
  ): Promise<string> {
    const { promise, resolve, reject } = PromiseWithResolvers<string>();
    
    // Create or get the socket
    const socket = this.createSocket(endpoint);
    
    // Set up event listeners
    socket.once('access-token', (token) => {
      resolve(token);
    });
    
    socket.once('access-token-error', (cause) => {
      reject(
        new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
          cause,
          message: 'Error getting access token',
        })
      );
    });
    
    socket.once('connect_error', (cause) => {
      reject(
        new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
          message: 'Could not connect to socket.',
          cause,
        })
      );
    });
    
    // Join the room to receive access token
    socket.emit('joinAccessTokenRoom', { state: sessionKey });
    
    // Set up timeout
    this.timeoutHandle = setTimeout(() => {
      reject(
        new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
          message: `Authentication timed out. Couldn't receive access token in ${timeoutMs / 1000} seconds. Please try again.`,
        })
      );
    }, timeoutMs);
    
    try {
      return await promise;
    } finally {
      this.cleanupTimeout();
    }
  }

  cleanupTimeout() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  cleanup() {
    this.cleanupTimeout();
    
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
