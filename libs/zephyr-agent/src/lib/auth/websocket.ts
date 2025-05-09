import { io as socketio, type Socket } from 'socket.io-client';
import { PromiseWithResolvers } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';
import { getSharedRoomId } from '../node-persist/shared-room-id';

interface ClientToServerEvents {
  joinAccessTokenRoom: (props: { state: string }) => void;
  joinSharedRoom: (props: { roomId: string; state: string }) => void;
}

interface ServerToClientEvents {
  'access-token': (token: string) => void;
  'access-token-error': (msg: string) => void;
  'shared-token': (token: string) => void;
}

export class WebSocketManager {
  private static instance: WebSocketManager;
  private activeSocket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private lastConnectionAttempt = 0;
  private readonly COOLDOWN_PERIOD = 5000; // 5 seconds
  private timeoutHandle: NodeJS.Timeout | null = null;
  private sharedRoomId: string | null = null;
  private tokenListeners: Set<(token: string) => void> = new Set();
  private authInProgress = false;

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

  isAuthInProgress(): boolean {
    return this.authInProgress;
  }

  setAuthInProgress(status: boolean): void {
    this.authInProgress = status;
  }

  /**
   * Gets a persistent machine-specific room ID for shared authentication This ensures all
   * processes on the same machine join the same room
   */
  private async getSharedRoomId(): Promise<string> {
    if (this.sharedRoomId) {
      return this.sharedRoomId;
    }

    // Get the persistent shared room ID from storage
    this.sharedRoomId = await getSharedRoomId();

    ze_log('debug', `Using shared room ID: ${this.sharedRoomId}`);
    return this.sharedRoomId;
  }

  /**
   * Register a callback to be notified when a token is received from another process in
   * the shared room
   */
  onSharedToken(callback: (token: string) => void): void {
    this.tokenListeners.add(callback);
  }

  /** Remove a previously registered callback */
  removeTokenListener(callback: (token: string) => void): void {
    this.tokenListeners.delete(callback);
  }

  createSocket(endpoint: string): Socket<ServerToClientEvents, ClientToServerEvents> {
    this.lastConnectionAttempt = Date.now();

    if (this.hasActiveConnection() && this.activeSocket) {
      return this.activeSocket;
    }

    this.activeSocket = socketio(endpoint, {
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true,
    });

    this.activeSocket.on('disconnect', () => {
      this.activeSocket = null;
    });

    // Listen for shared tokens from other processes
    this.activeSocket.on('shared-token', (token) => {
      ze_log('debug', 'Received token from shared room');

      // Notify all registered listeners
      this.tokenListeners.forEach((listener) => {
        try {
          listener(token);
        } catch (err) {
          ze_log('error', 'Error in token listener', err);
        }
      });
    });

    return this.activeSocket;
  }

  /**
   * Requests an access token via WebSocket.
   *
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

    // Get the shared room ID for this machine
    const sharedRoomId = await this.getSharedRoomId();
    ze_log('debug', `Using shared room ID: ${sharedRoomId}`);

    // Create or get the socket
    const socket = this.createSocket(endpoint);

    // Set up event listeners
    socket.once('access-token', (token) => {
      ze_log('debug', 'Received access token from server');

      // Share the token with other processes in the same room
      if (socket.connected) {
        ze_log('debug', 'Sharing token with other processes');
        socket.emit('joinSharedRoom', { roomId: sharedRoomId, state: sessionKey });
      }

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

    // Also listen for shared tokens from other processes
    const sharedTokenListener = (token: string) => {
      ze_log('debug', 'Using token shared from another process');
      resolve(token);
    };

    // Register the listener
    this.onSharedToken(sharedTokenListener);

    // Join both the access token room and the shared room
    socket.emit('joinAccessTokenRoom', { state: sessionKey });
    socket.emit('joinSharedRoom', { roomId: sharedRoomId, state: sessionKey });

    // Set up timeout
    this.timeoutHandle = setTimeout(() => {
      this.removeTokenListener(sharedTokenListener);
      reject(
        new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
          message: `Authentication timed out. Couldn't receive access token in ${timeoutMs / 1000} seconds. Please try again.`,
        })
      );
    }, timeoutMs);

    try {
      return await promise;
    } finally {
      this.removeTokenListener(sharedTokenListener);
      this.cleanupTimeout();
    }
  }

  cleanupTimeout() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }
}

export function createSocket(
  endpoint: string
): Socket<ServerToClientEvents, ClientToServerEvents> {
  return WebSocketManager.getInstance().createSocket(endpoint);
}
