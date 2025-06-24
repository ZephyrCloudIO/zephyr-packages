/** Interface representing the version information for a native app platform */
export interface NativeVersionInfo {
  /** The semantic version of the app (e.g. "1.2.3") */
  native_version: string;

  /** The file path of the native version info */
  file_path: string;

  /** The variable name of the native version info */
  variable_name: string;
}

/** Supported platform types for React Native builds */
export type NativePlatform = 'ios' | 'android' | 'windows' | 'macos' | 'web' | undefined;
