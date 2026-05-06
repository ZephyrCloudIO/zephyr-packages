import { useCallback, useEffect, useState } from 'react';
import type { UpdateAvailableEvent } from '../events';
import {
  getCacheStatus,
  getRegisteredCacheLayer,
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
  clearUpdateNotification: () => void;
}

export function useCacheStatus(): UseCacheStatusResult {
  const [status, setStatus] = useState<CacheStatusSnapshot>(
    () => getCacheStatus() ?? INITIAL_STATUS
  );
  const [latestUpdateEvent, setLatestUpdateEvent] = useState<UpdateAvailableEvent | null>(
    null
  );

  const clearUpdateNotification = useCallback(() => {
    setLatestUpdateEvent(null);
  }, []);

  useEffect(() => {
    const unsubscribeStatus = subscribeCacheStatus(setStatus);
    const cacheLayer = getRegisteredCacheLayer();
    if (!cacheLayer) return unsubscribeStatus;

    const onUpdateAvailable = (event: UpdateAvailableEvent) => {
      setLatestUpdateEvent(event);
    };

    cacheLayer.events.on('update:available', onUpdateAvailable);

    return () => {
      unsubscribeStatus();
      cacheLayer.events.off('update:available', onUpdateAvailable);
    };
  }, []);

  return { status, latestUpdateEvent, clearUpdateNotification };
}
