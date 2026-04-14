import mitt, { type Handler } from 'mitt';
import type { BundleLoadEvent, CacheEventMap } from './types';

export class CacheEvents {
  private emitter = mitt<CacheEventMap>();

  on<K extends keyof CacheEventMap>(event: K, handler: Handler<CacheEventMap[K]>): void {
    this.emitter.on(event, handler);
  }

  off<K extends keyof CacheEventMap>(event: K, handler: Handler<CacheEventMap[K]>): void {
    this.emitter.off(event, handler);
  }

  emitBundleLoad(
    bundleUrl: string,
    remoteName: string,
    status: BundleLoadEvent['status'],
    hash: string | undefined
  ): void {
    this.emitter.emit('bundle:load', {
      bundleUrl,
      remoteName,
      status,
      hash,
      timestamp: Date.now(),
    });
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
