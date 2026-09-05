import type { BundleLoadEvent, CacheEventMap } from './types';

type EventHandler<K extends keyof CacheEventMap> = (event: CacheEventMap[K]) => void;
type EventHandlers = {
  [K in keyof CacheEventMap]?: EventHandler<K>[];
};

export class CacheEvents {
  private handlers: EventHandlers = {};

  // bundle:load events fire during MF remote resolution, which happens before
  // React mounts. UI hooks that subscribe later would miss the initial load
  // statuses. This buffer lets late subscribers replay what already happened.
  private loadEventBuffer: BundleLoadEvent[] = [];

  on<K extends keyof CacheEventMap>(event: K, handler: EventHandler<K>): void {
    const handlers = this.handlers[event] as EventHandler<K>[] | undefined;
    if (handlers) {
      handlers.push(handler);
      return;
    }

    this.handlers[event] = [handler] as EventHandlers[K];
  }

  off<K extends keyof CacheEventMap>(event: K, handler: EventHandler<K>): void {
    const handlers = this.handlers[event] as EventHandler<K>[] | undefined;
    if (!handlers) return;

    const index = handlers.indexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
  }

  /**
   * Returns buffered bundle:load events and clears the buffer. Intended to be called once
   * during UI initialization.
   */
  drainLoadEvents(): BundleLoadEvent[] {
    const events = this.loadEventBuffer;
    this.loadEventBuffer = [];
    return events;
  }

  emitBundleLoad(
    bundleUrl: string,
    remoteName: string,
    status: BundleLoadEvent['status'],
    hash: string | undefined
  ): void {
    const event: BundleLoadEvent = {
      bundleUrl,
      remoteName,
      status,
      hash,
      timestamp: Date.now(),
    };
    this.loadEventBuffer.push(event);
    this.emit('bundle:load', event);
  }

  emitPollStart(): void {
    this.emit('poll:start', undefined);
  }

  emitUpdateAvailable(
    bundleUrl: string,
    remoteName: string,
    oldHash: string | undefined,
    newHash: string
  ): void {
    this.emit('update:available', {
      bundleUrl,
      remoteName,
      oldHash,
      newHash,
      timestamp: Date.now(),
    });
  }

  emitUpdateDownloaded(bundleUrl: string, remoteName: string, newHash: string): void {
    this.emit('update:downloaded', {
      bundleUrl,
      remoteName,
      newHash,
      timestamp: Date.now(),
    });
  }

  emitPollComplete(checked: number, updated: number): void {
    this.emit('poll:complete', {
      checked,
      updated,
      timestamp: Date.now(),
    });
  }

  private emit<K extends keyof CacheEventMap>(event: K, value: CacheEventMap[K]): void {
    const handlers = this.handlers[event] as EventHandler<K>[] | undefined;
    handlers?.slice().forEach((handler) => handler(value));
  }
}
