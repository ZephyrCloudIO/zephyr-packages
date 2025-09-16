import { EventSource } from 'eventsource';
import { ze_debug } from '../logging';
import { ZeErrors, ZephyrError } from '../errors';

export class AuthListener {
  private workerUrl: URL;
  constructor(workerUrl: URL) {
    workerUrl.pathname = '/sse';
    this.workerUrl = workerUrl;
  }

  async waitForToken(
    timeoutMs = 5 * 60 * 1000
  ): Promise<{ sessionId: string; token: string }> {
    const sessionId = this.workerUrl.searchParams.get('sessionId');
    if (!sessionId) {
      throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: 'Session ID is required',
      });
    }

    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(this.workerUrl);

      const timeout = setTimeout(() => {
        eventSource.close();
        reject(
          new ZephyrError(ZeErrors.ERR_UNKNOWN, {
            message: 'Auth timeout',
          })
        );
      }, timeoutMs);

      eventSource.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'token') {
            clearTimeout(timeout);
            eventSource.close();
            const token = data.token ?? data.tokens?.access_token;
            resolve({ sessionId, token });
          } else if (data.type === 'error') {
            clearTimeout(timeout);
            eventSource.close();
            reject(new Error(data.message));
          } else {
            ze_debug('AuthListener', `Unknown message type: ${data.type}`);
          }
        } catch (err) {
          clearTimeout(timeout);
          eventSource.close();
          reject(err);
        }
      };

      eventSource.onerror = (error: Event) => {
        clearTimeout(timeout);
        eventSource.close();
        reject(error);
      };
    });
  }
}
