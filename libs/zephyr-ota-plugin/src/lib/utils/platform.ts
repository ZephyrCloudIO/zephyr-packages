import { Platform } from 'react-native';

/** Supported build target platforms */
export type BuildTarget = 'ios' | 'android';

const SUPPORTED_PLATFORMS: readonly BuildTarget[] = ['ios', 'android'];

/**
 * Get the current build target based on the React Native platform
 *
 * @returns The current platform as a build target string
 * @throws Error if the platform is not supported (only iOS and Android are supported)
 */
export function getBuildTarget(): BuildTarget {
  const os = Platform.OS;
  if (!SUPPORTED_PLATFORMS.includes(os as BuildTarget)) {
    // eslint-disable-next-line no-restricted-syntax -- Platform validation before Zephyr features can be used
    throw new Error(
      `Unsupported platform: ${os}. Zephyr OTA updates only support iOS and Android.`
    );
  }
  return os as BuildTarget;
}

/** Check if running on iOS */
export function isIOS(): boolean {
  return Platform.OS === 'ios';
}

/** Check if running on Android */
export function isAndroid(): boolean {
  return Platform.OS === 'android';
}
