import mitt, { type Handler } from 'mitt';
import type { BundleLoadEvent, CacheEventMap } from './types';

export class CacheEvents {
  private emitter = mitt<CacheEventMap>();

  // bundle:load events fire during MF remote resolution, which happens before
  // React mounts. UI hooks that subscribe later would miss the initial load
  // statuses. This buffer lets late subscribers replay what already happened.
  private loadEventBuffer: BundleLoadEvent[] = [];

  on<K extends keyof CacheEventMap>(event: K, handler: Handler<CacheEventMap[K]>): void {
    this.emitter.on(event, handler);
  }

  off<K extends keyof CacheEventMap>(event: K, handler: Handler<CacheEventMap[K]>): void {
    this.emitter.off(event, handler);
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
    this.emitter.emit('bundle:load', event);
  }

  emitPollStart(): void {
    this.emitter.emit('poll:start');
  }

  emitUpdateAvailable(
    bundleUrl: string,
    remoteName: string,
    oldHash: string | undefined,
    newHash: string
  ): void {
    this.emitter.emit('update:available', {
      bundleUrl,
      remoteName,
      oldHash,
      newHash,
      timestamp: Date.now(),
    });
  }

  emitUpdateDownloaded(bundleUrl: string, remoteName: string, newHash: string): void {
    this.emitter.emit('update:downloaded', {
      bundleUrl,
      remoteName,
      newHash,
      timestamp: Date.now(),
    });
  }

  emitPollComplete(checked: number, updated: number): void {
    this.emitter.emit('poll:complete', {
      checked,
      updated,
      timestamp: Date.now(),
    });
  }
}
