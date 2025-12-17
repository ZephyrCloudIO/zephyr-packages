import { useZephyrOTAContext } from './ZephyrOTAProvider';
import type { RemoteVersionInfo } from '../types';

/**
 * Return type for useOTAStatus hook
 */
export interface OTAStatusResult {
  /**
   * Whether an update check is in progress
   */
  isChecking: boolean;

  /**
   * Whether updates are available
   */
  hasUpdates: boolean;

  /**
   * Number of remotes with updates
   */
  updateCount: number;

  /**
   * Names of remotes with updates
   */
  updatedRemotes: string[];

  /**
   * When the last update check occurred
   */
  lastChecked: Date | null;

  /**
   * Any error that occurred during update check
   */
  error: Error | null;
}

/**
 * Lightweight hook that provides read-only OTA status
 *
 * Use this when you only need to display status information
 * without triggering updates or applying changes.
 *
 * Must be used within a ZephyrOTAProvider
 *
 * @returns Read-only OTA status
 *
 * @example
 * ```tsx
 * function StatusIndicator() {
 *   const { hasUpdates, updateCount, isChecking } = useOTAStatus();
 *
 *   if (isChecking) return <Spinner />;
 *   if (hasUpdates) return <Badge count={updateCount} />;
 *   return <Text>Up to date</Text>;
 * }
 * ```
 */
export function useOTAStatus(): OTAStatusResult {
  const context = useZephyrOTAContext();

  return {
    isChecking: context.isChecking,
    hasUpdates: context.hasUpdates,
    updateCount: context.updates.length,
    updatedRemotes: context.updates.map((u: RemoteVersionInfo) => u.name),
    lastChecked: context.lastChecked,
    error: context.error,
  };
}
