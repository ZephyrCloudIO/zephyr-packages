import { useZephyrOTAContext } from './ZephyrOTAProvider';
import type { ZephyrOTAContextValue } from './ZephyrOTAProvider';

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
  return useZephyrOTAContext();
}
