import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  ZephyrOTAConfig,
  ZephyrOTAUpdate,
  ZephyrOTAWorker,
} from './zephyr-ota-worker';
import { ZephyrOTAWorker as Worker } from './zephyr-ota-worker';

export interface UseZephyrOTAOptions extends ZephyrOTAConfig {
  /** Auto-start the worker when hook mounts */
  autoStart?: boolean;
}

export interface ZephyrOTAState {
  /** Whether the worker is currently active */
  isActive: boolean;
  /** Available update, if any */
  availableUpdate: ZephyrOTAUpdate | null;
  /** Whether an update check is in progress */
  isChecking: boolean;
  /** Whether an update is being applied */
  isApplying: boolean;
  /** Last error that occurred */
  lastError: Error | null;
  /** Whether the last update was applied successfully */
  updateApplied: boolean;
}

export interface ZephyrOTAActions {
  /** Start the OTA worker */
  start: () => void;
  /** Stop the OTA worker */
  stop: () => void;
  /** Manually trigger update check */
  checkForUpdates: () => void;
  /** Apply the available update */
  applyUpdate: () => Promise<void>;
  /** Decline the available update */
  declineUpdate: () => Promise<void>;
  /** Clear the last error */
  clearError: () => void;
  /** Clear the update applied flag */
  clearUpdateApplied: () => void;
}

export function useZephyrOTA(
  options: UseZephyrOTAOptions
): [ZephyrOTAState, ZephyrOTAActions] {
  const workerRef = useRef<ZephyrOTAWorker | null>(null);
  const runtimePluginRef = useRef<any>(null);

  const [state, setState] = useState<ZephyrOTAState>({
    isActive: false,
    availableUpdate: null,
    isChecking: false,
    isApplying: false,
    lastError: null,
    updateApplied: false,
  });

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(options, {
      onUpdateAvailable: (update) => {
        setState((prev) => ({
          ...prev,
          availableUpdate: update,
          isChecking: false,
        }));
      },
      onUpdateError: (error) => {
        setState((prev) => ({
          ...prev,
          lastError: error,
          isChecking: false,
        }));
      },
      onUpdateApplied: (version) => {
        setState((prev) => ({
          ...prev,
          updateApplied: true,
          availableUpdate: null,
          isApplying: false,
          lastError: null,
        }));
      },
      onUpdateFailed: (error) => {
        setState((prev) => ({
          ...prev,
          lastError: error,
          isApplying: false,
        }));
      },
    });

    workerRef.current = worker;

    // Auto-start if enabled
    if (options.autoStart !== false) {
      worker.start();
      setState((prev) => ({ ...prev, isActive: true }));
    }

    return () => {
      worker.stop();
      workerRef.current = null;
    };
  }, []);

  // Set runtime plugin if available globally
  useEffect(() => {
    const global = typeof window !== 'undefined' ? window : globalThis;
    const runtimePlugin = (global as any).__ZEPHYR_RUNTIME_PLUGIN_INSTANCE__;

    if (runtimePlugin && workerRef.current) {
      workerRef.current.setRuntimePlugin(runtimePlugin);
      runtimePluginRef.current = runtimePlugin;
    }
  }, []);

  const actions: ZephyrOTAActions = {
    start: useCallback(() => {
      if (workerRef.current && !state.isActive) {
        workerRef.current.start();
        setState((prev) => ({ ...prev, isActive: true }));
      }
    }, [state.isActive]),

    stop: useCallback(() => {
      if (workerRef.current && state.isActive) {
        workerRef.current.stop();
        setState((prev) => ({
          ...prev,
          isActive: false,
          isChecking: false,
          isApplying: false,
        }));
      }
    }, [state.isActive]),

    checkForUpdates: useCallback(() => {
      if (workerRef.current && state.isActive) {
        setState((prev) => ({ ...prev, isChecking: true, lastError: null }));
        // The worker will handle the actual check and trigger callbacks
        (workerRef.current as any).performUpdateCheck?.();
      }
    }, [state.isActive]),

    applyUpdate: useCallback(async () => {
      if (!state.availableUpdate || !workerRef.current || state.isApplying) {
        return;
      }

      setState((prev) => ({ ...prev, isApplying: true, lastError: null }));

      try {
        await workerRef.current.applyUpdate(state.availableUpdate);
        // Success handled by callback
      } catch (error) {
        // Error handled by callback
        console.error('Failed to apply OTA update:', error);
      }
    }, [state.availableUpdate, state.isApplying]),

    declineUpdate: useCallback(async () => {
      if (!state.availableUpdate || !workerRef.current) {
        return;
      }

      try {
        await workerRef.current.declineUpdate(state.availableUpdate.version);
        setState((prev) => ({
          ...prev,
          availableUpdate: null,
          lastError: null,
        }));
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error('Failed to decline update');
        setState((prev) => ({ ...prev, lastError: err }));
      }
    }, [state.availableUpdate]),

    clearError: useCallback(() => {
      setState((prev) => ({ ...prev, lastError: null }));
    }, []),

    clearUpdateApplied: useCallback(() => {
      setState((prev) => ({ ...prev, updateApplied: false }));
    }, []),
  };

  return [state, actions];
}

/** Hook for simple update availability checking without full worker management */
export function useZephyrUpdateCheck(applicationUid: string): {
  hasUpdate: boolean;
  updateInfo: ZephyrOTAUpdate | null;
  checkForUpdates: () => void;
  isChecking: boolean;
  error: Error | null;
} {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<ZephyrOTAUpdate | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const checkForUpdates = useCallback(async () => {
    if (isChecking) return;

    setIsChecking(true);
    setError(null);

    try {
      // Create a temporary worker just for checking
      const worker = new Worker(
        {
          applicationUid,
          debug: false,
        },
        {
          onUpdateAvailable: (update) => {
            setHasUpdate(true);
            setUpdateInfo(update);
            setIsChecking(false);
          },
          onUpdateError: (err) => {
            setError(err);
            setIsChecking(false);
          },
        }
      );

      // Perform a single check
      await (worker as any).checkForUpdates();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Update check failed');
      setError(error);
      setIsChecking(false);
    }
  }, [applicationUid, isChecking]);

  return {
    hasUpdate,
    updateInfo,
    checkForUpdates,
    isChecking,
    error,
  };
}
