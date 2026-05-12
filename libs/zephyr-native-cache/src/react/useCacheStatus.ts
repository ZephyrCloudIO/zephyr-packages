import { useEffect, useState } from 'react';
import type { UpdateAvailableEvent } from '../events';
import {
  getCacheStatus,
  getRegisteredCacheLayer,
  subscribeCacheLayerRegistration,
  subscribeCacheStatus,
} from '../register';
import type { CacheStatusSnapshot } from '../types';

const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;

const INITIAL_STATUS: CacheStatusSnapshot = {
  remotes: {},
  pollingEnabled: false,
  pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  isPolling: false,
  lastPollAt: undefined,
  lastPollResult: undefined,
  pendingUpdates: [],
};

export interface UseCacheStatusResult {
  status: CacheStatusSnapshot;
  latestUpdateEvent: UpdateAvailableEvent | null;
}

export function useCacheStatus(): UseCacheStatusResult {
  const [status, setStatus] = useState<CacheStatusSnapshot>(
    () => getCacheStatus() ?? INITIAL_STATUS
  );
  const [latestUpdateEvent, setLatestUpdateEvent] = useState<UpdateAvailableEvent | null>(
    null
  );

  useEffect(() => {
    let unsubscribeStatus = () => {};
    let unsubscribeUpdateAvailable = () => {};

    const onUpdateAvailable = (event: UpdateAvailableEvent) => {
      setLatestUpdateEvent(event);
    };

    const bindCacheLayer = () => {
      unsubscribeStatus();
      unsubscribeUpdateAvailable();

      const cacheLayer = getRegisteredCacheLayer();
      if (!cacheLayer) return;

      unsubscribeStatus = subscribeCacheStatus(setStatus);
      cacheLayer.events.on('update:available', onUpdateAvailable);
      unsubscribeUpdateAvailable = () => {
        cacheLayer.events.off('update:available', onUpdateAvailable);
      };
    };

    bindCacheLayer();
    const unsubscribeRegistration = subscribeCacheLayerRegistration(bindCacheLayer);

    return () => {
      unsubscribeRegistration();
      unsubscribeStatus();
      unsubscribeUpdateAvailable();
    };
  }, []);

  return { status, latestUpdateEvent };
}
