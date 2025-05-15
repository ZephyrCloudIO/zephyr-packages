/** Interface representing the version information for a native app platform */
export interface NativeVersionInfo {
  /** The semantic version of the app (e.g. "1.2.3") */
  native_version: string;

  /**
   * The build number of the app (e.g. "42" for Android, "1.2.3.4" for iOS/macOS,
   * "1.0.0.0" for Windows)
   */
  native_build_number: string;
}

/** Supported platform types for React Native builds */
export type NativePlatform = 'ios' | 'android' | 'windows' | 'macos' | 'web' | undefined;

/** Constants for accessing native version information in JavaScript */
export const NativeVersionConstants = {
  /** The version of the native app */
  VERSION: 'ZE_NATIVE_VERSION',

  /** The build number of the native app */
  BUILD_NUMBER: 'ZE_NATIVE_BUILD_NUMBER',

  /** The platform of the native app ('ios', 'android', 'windows', 'macos', or 'web') */
  PLATFORM: 'ZE_NATIVE_PLATFORM',

  /** The property that will be set to true when all native version info is available */
  IS_AVAILABLE: 'ZE_NATIVE_VERSION_AVAILABLE',
};
