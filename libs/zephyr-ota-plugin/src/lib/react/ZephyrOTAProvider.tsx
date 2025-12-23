import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { RemoteVersionInfo, UpdateCheckResult } from '../types';
import { ZephyrOTAService } from '../core/ZephyrOTAService';
import { createScopedLogger } from '../utils/logger';
import type { ZephyrOTAContextValue, ZephyrOTAProviderProps } from './types';

export type { ZephyrOTAContextValue, ZephyrOTAProviderProps } from './types';

const logger = createScopedLogger('Provider');

const ZephyrOTAContext = createContext<ZephyrOTAContextValue | null>(null);

/**
 * Provider component for Zephyr OTA functionality using manifest-based update detection.
 *
 * The provider fetches the zephyr-manifest.json from your host app's deployed URL and uses
 * it to detect available updates.
 *
 * @example
 *   Basic usage
 *   ```tsx
 *   <ZephyrOTAProvider config={{ hostUrl: 'https://myapp.zephyrcloud.app' }}>
 *     <App />
 *   </ZephyrOTAProvider>
 *   ```
 *
 * @example
 *   With update callbacks
 *   ```tsx
 *   <ZephyrOTAProvider
 *     config={{ hostUrl: 'https://myapp.zephyrcloud.app' }}
 *     onUpdateAvailable={(updates) => {
 *       console.log('Updates available:', updates.map(u => u.name));
 *     }}
 *   >
 *     <App />
 *   </ZephyrOTAProvider>
 *   ```
 */
export function ZephyrOTAProvider({
  children,
  config,
  onUpdateAvailable,
  onUpdateApplied,
  onError,
}: ZephyrOTAProviderProps): React.ReactElement {
  const [isChecking, setIsChecking] = useState(false);
  const [hasUpdates, setHasUpdates] = useState(false);
  const [updates, setUpdates] = useState<RemoteVersionInfo[]>([]);
  const [remotes, setRemotes] = useState<RemoteVersionInfo[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const isInitialized = useRef(false);
  const serviceRef = useRef<ZephyrOTAService | null>(null);

  // Validate config
  if (!config.hostUrl) {
    logger.error('ZephyrOTAProvider: hostUrl is required in config');
  }

  // Create service instance
  const service = useMemo(() => {
    if (!config.hostUrl) {
      return null;
    }

    // Reset service when config changes
    if (serviceRef.current) {
      serviceRef.current.stopPeriodicChecks();
      serviceRef.current = null;
      isInitialized.current = false;
    }

    try {
      serviceRef.current = ZephyrOTAService.getInstance(config);
      return serviceRef.current;
    } catch (err) {
      logger.error('Failed to create OTA service:', err);
      return null;
    }
  }, [config]);

  // Handle update check results
  const handleUpdateResult = useCallback(
    async (result: UpdateCheckResult) => {
      if (!service) return;

      logger.debug('handleUpdateResult called:', {
        hasUpdates: result.hasUpdates,
        remotesCount: result.remotes.length,
      });

      setLastChecked(new Date(result.timestamp));
      setRemotes(result.remotes);

      if (result.hasUpdates) {
        // Check if user has dismissed updates recently
        const isDismissed = await service.isDismissed();
        logger.debug('Updates available, isDismissed:', isDismissed);

        if (!isDismissed) {
          const updatesWithChanges = result.remotes.filter((r) => r.hasUpdate);
          logger.debug('Setting hasUpdates=true, updates:', updatesWithChanges);
          setUpdates(updatesWithChanges);
          setHasUpdates(true);
          onUpdateAvailable?.(updatesWithChanges);
        } else {
          logger.debug('Updates dismissed by user, not showing');
        }
      } else {
        logger.debug('No updates available');
      }
    },
    [service, onUpdateAvailable]
  );

  // Check for updates
  const checkForUpdates = useCallback(
    async (options?: { force?: boolean }): Promise<UpdateCheckResult> => {
      if (!service) {
        logger.debug('Service not initialized, skipping check');
        return {
          hasUpdates: false,
          remotes: [],
          timestamp: Date.now(),
        };
      }

      const force = options?.force ?? true;
      logger.debug('checkForUpdates called, force:', force);

      if (isChecking) {
        logger.debug('Already checking, skipping');
        return {
          hasUpdates: false,
          remotes: [],
          timestamp: Date.now(),
        };
      }

      setIsChecking(true);
      setError(null);

      try {
        logger.debug('Calling service.checkForUpdates()...');
        const result = await service.checkForUpdates(force);
        logger.debug('checkForUpdates result:', result);
        await handleUpdateResult(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Update check failed');
        logger.error('Check failed:', error);
        setError(error);
        onError?.(error);
        return {
          hasUpdates: false,
          remotes: [],
          timestamp: Date.now(),
        };
      } finally {
        setIsChecking(false);
      }
    },
    [isChecking, service, handleUpdateResult, onError]
  );

  // Apply updates
  const applyUpdates = useCallback(async () => {
    if (!service || updates.length === 0) {
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      await service.applyUpdates(updates);

      // Clear update state before reload
      setHasUpdates(false);
      setUpdates([]);

      logger.info('Updates applied, reloading app...');
      onUpdateApplied?.();

      // Note: App will reload, so we don't set isChecking=false
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to apply updates');
      logger.error('Apply failed:', error);
      setError(error);
      setIsChecking(false);
      onError?.(error);
    }
  }, [updates, service, onUpdateApplied, onError]);

  // Dismiss updates
  const dismissUpdates = useCallback(async () => {
    if (!service) return;
    await service.dismiss();
    setHasUpdates(false);
    setUpdates([]);
  }, [service]);

  // Get version info for a specific remote
  const getRemoteVersion = useCallback(
    (remoteName: string): RemoteVersionInfo | undefined => {
      return remotes.find((r: RemoteVersionInfo) => r.name === remoteName);
    },
    [remotes]
  );

  // Initialize and set up listeners
  useEffect(() => {
    if (!service || isInitialized.current) {
      return;
    }
    isInitialized.current = true;

    logger.debug('Initializing OTA service');

    // Initialize version tracking from manifest
    void service.initializeVersionTracking();

    // Subscribe to update events from service
    const unsubscribe = service.onUpdateAvailable((result) => {
      void handleUpdateResult(result);
    });

    // Start periodic checks
    service.startPeriodicChecks();

    // Do initial check
    void checkForUpdates();

    return () => {
      unsubscribe();
      service.stopPeriodicChecks();
    };
  }, [service, handleUpdateResult, checkForUpdates]);

  // Handle app state changes (foreground check)
  useEffect(() => {
    // Default to true if not specified
    const checkOnForeground = config.checkOnForeground ?? true;
    if (!checkOnForeground || !service) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // App came to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        logger.debug('App foregrounded, checking for updates');
        void checkForUpdates();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [config.checkOnForeground, service, checkForUpdates]);

  const value: ZephyrOTAContextValue = {
    isChecking,
    hasUpdates,
    updates,
    remotes,
    lastChecked,
    error,
    checkForUpdates,
    applyUpdates,
    dismissUpdates,
    getRemoteVersion,
  };

  return <ZephyrOTAContext.Provider value={value}>{children}</ZephyrOTAContext.Provider>;
}

/**
 * Hook to access Zephyr OTA functionality
 *
 * Must be used within a ZephyrOTAProvider
 *
 * @example
 *   ```tsx
 *   function UpdateBanner() {
 *     const { hasUpdates, updates, applyUpdates, dismissUpdates } = useZephyrOTA();
 *
 *     if (!hasUpdates) return null;
 *
 *     return (
 *       <View>
 *         <Text>Updates available for: {updates.map(u => u.name).join(', ')}</Text>
 *         <Button onPress={applyUpdates} title="Update Now" />
 *         <Button onPress={dismissUpdates} title="Later" />
 *       </View>
 *     );
 *   }
 *   ```;
 *
 * @returns OTA context value with state and actions
 */
export function useZephyrOTA(): ZephyrOTAContextValue {
  const context = useContext(ZephyrOTAContext);
  if (!context) {
    throw new Error('useZephyrOTA must be used within a ZephyrOTAProvider');
  }
  return context;
}
