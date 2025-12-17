import { Platform } from 'react-native';

/**
 * Supported build target platforms
 */
export type BuildTarget = 'ios' | 'android';

/**
 * Get the current build target based on the React Native platform
 *
 * @returns The current platform as a build target string
 */
export function getBuildTarget(): BuildTarget {
  return Platform.OS as BuildTarget;
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  return Platform.OS === 'ios';
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
  return Platform.OS === 'android';
}
