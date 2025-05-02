import { ZeErrors, ZephyrError } from 'zephyr-agent';
import { NativeVersionInfo, NativePlatform } from '../../type/native-version';
import {
  getAndroidVersionInfoAsync,
  getAndroidVersionInfoSync,
} from './get-android-version';
import { getIOSVersionInfoAsync, getIOSVersionInfoSync } from './get-ios-version';
import {
  getWindowsVersionInfoAsync,
  getWindowsVersionInfoSync,
} from './get-windows-info';
import { getMacOSVersionInfoAsync, getMacOSVersionInfoSync } from './get-macos-version';

// TODO: move this to zephyr-agent
/**
 * Get native version information for the specified platform
 *
 * @param platform The target platform ('ios', 'android', 'windows', 'macos', 'web', etc.)
 * @param projectRoot The root directory of the React Native project
 * @returns Object with version and build number
 */
export async function getNativeVersionInfoAsync(
  platform: NativePlatform,
  projectRoot: string
): Promise<NativeVersionInfo> {
  if (!projectRoot) {
    throw new Error('Project root directory is required');
  }

  switch (platform) {
    case 'ios':
      return getIOSVersionInfoAsync(projectRoot);
    case 'android':
      return getAndroidVersionInfoAsync(projectRoot);
    case 'windows':
      return getWindowsVersionInfoAsync(projectRoot);
    case 'macos':
      return getMacOSVersionInfoAsync(projectRoot);
    default:
      throw new ZephyrError(ZeErrors.ERR_MISSING_NATIVE_VERSION);
  }

  // For web platform, read from package.json
  // try {
  //   const packageJsonPath = path.join(projectRoot, 'package.json');
  //   if (fs.existsSync(packageJsonPath)) {
  //       const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  //       return {
  //         version: packageJson.version || '0.0.0',
  //         buildNumber: packageJson.buildNumber || packageJson.version || '0'
  //       };
  //     }
  //   } catch (error) {
  //     ze_log('Error reading web version from package.json:', error);
  //   }

  //   return {
  //     version: '0.0.0',
  //     buildNumber: '0'
  //   };
  // }

  // throw new Error(`Unsupported platform: ${platform}. Use 'ios', 'android', 'windows', 'macos', or 'web'.`);
}

/**
 * Sync version of getNativeVersionInfo that returns cached or parsed values without async
 * file operations when possible
 *
 * @param platform The target platform ('ios', 'android', 'windows', 'macos', 'web', etc.)
 * @param projectRoot The root directory of the React Native project
 * @returns Object with version and build number
 */
export function getNativeVersionInfoSync(
  platform: NativePlatform,
  projectRoot: string
): NativeVersionInfo {
  if (!projectRoot) {
    throw new Error('Project root directory is required');
  }

  try {
    switch (platform) {
      case 'ios':
        return getIOSVersionInfoSync(projectRoot);
      case 'android':
        return getAndroidVersionInfoSync(projectRoot);
      case 'windows':
        return getWindowsVersionInfoSync(projectRoot);
      case 'macos':
        return getMacOSVersionInfoSync(projectRoot);
      default:
        throw new ZephyrError(ZeErrors.ERR_MISSING_NATIVE_VERSION);
    }
  } catch (error) {
    console.error(`Error in getNativeVersionInfoSync for ${platform}:`, error);
    throw new ZephyrError(ZeErrors.ERR_MISSING_NATIVE_VERSION);
  }

  throw new ZephyrError(ZeErrors.ERR_MISSING_NATIVE_VERSION);
}
