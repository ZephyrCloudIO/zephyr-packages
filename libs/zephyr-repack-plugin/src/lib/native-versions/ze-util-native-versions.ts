import { ZeErrors, ZephyrError, logFn, ze_log } from 'zephyr-agent';
import type { NativeVersionInfo, NativePlatform } from '../../type/native-version';
import * as child_process from 'child_process';
import * as util from 'util';
import isCI from 'is-ci';
import { getAndroidVersionInfoAsync } from './get-android-version';
import { getIOSVersionInfoAsync } from './get-ios-version';
import { getWindowsVersionInfoAsync } from './get-windows-info';
import { isValidSemver, extractSemverFromTag } from 'zephyr-agent';

const exec = util.promisify(child_process.exec);

// Default values to use when version formatting is invalid
export const DEFAULT_VERSION = '0.0.1';
export const DEFAULT_BUILD_NUMBER = '1';

/**
 * Gets the latest Git tag that points to the current commit
 *
 * @param platform Optional platform filter (ios, android)
 * @returns The semver-compatible version from the tag or null if not found
 */
export async function getGitTagVersion(
  platform?: NativePlatform
): Promise<string | null> {
  try {
    // Get all tags that point to HEAD
    const { stdout } = await exec('git tag --points-at HEAD');
    const tags = stdout.split('\n').filter(Boolean);

    if (!tags || !tags.length) {
      ze_log('No git tags found for platform: ', platform);
      return null;
    }

    // If platform is specified, first try to find platform-specific tags
    if (platform) {
      const platformTags = tags.filter((tag) =>
        tag.toLowerCase().includes(platform.toLowerCase())
      );

      // Try platform-specific tags first
      for (const tag of platformTags) {
        const version = extractSemverFromTag(tag);
        if (version && isValidSemver(version)) {
          logFn('info', `Found ${platform}-specific Git tag with version ${version}`);
          return version;
        }
      }
    }

    logFn('info', `No Git tags with valid semver format found among: ${tags.join(', ')}`);
    return null;
  } catch (error) {
    logFn('warn', `Failed to get Git tag version: ${error}`);
    return null;
  }
}

/**
 * Augments native version info with Git tag data in CI environments
 *
 * @param versionInfo The current version info from platform-specific methods
 * @param platform The platform this version is for
 * @returns Updated version info, potentially with Git tag-based version
 */
export async function augmentWithGitTagVersion(
  versionInfo: NativeVersionInfo,
  platform: NativePlatform
): Promise<NativeVersionInfo> {
  // Only use Git tags in CI environments
  const nativeVersion = versionInfo;
  if (!isCI) {
    if (!isValidSemver(versionInfo.native_version)) {
      throw new ZephyrError(ZeErrors.ERR_INCORRECT_SEMVER_VERSION);
    }

    return nativeVersion;
  }

  // Try to get version from Git tag
  const gitTagVersion = await getGitTagVersion(platform);

  if (gitTagVersion) {
    // In CI environments, prefer Git tag version over manifest file version
    logFn(
      'info',
      `Found git tag ${gitTagVersion}. Using Git tag version ${gitTagVersion} for ${platform} in CI environment`
    );
    return {
      native_version: gitTagVersion,
      native_build_number: versionInfo.native_build_number, // Keep the build number from manifest
    };
  }

  throw new ZephyrError(ZeErrors.ERR_MISSING_NATIVE_VERSION);
}

/**
 * Get native version information for the specified platform In CI environments, this
 * function will also attempt to extract version information from Git tags that point to
 * the current commit
 *
 * @param platform The target platform ('ios', 'android', 'windows', 'macos', 'web', etc.)
 * @param projectRoot The root directory of the React Native project
 * @returns Object with version and build number
 */
export async function getNativeVersionInfoAsync(
  platform: NativePlatform,
  projectRoot: string
): Promise<NativeVersionInfo> {
  let versionInfo: NativeVersionInfo | null = null;

  // First get the version info from the platform-specific files
  switch (platform) {
    case 'ios':
      versionInfo = await getIOSVersionInfoAsync(projectRoot);
      break;
    case 'android':
      versionInfo = await getAndroidVersionInfoAsync(projectRoot);
      break;
    case 'windows':
      versionInfo = await getWindowsVersionInfoAsync(projectRoot);
      break;
    case 'macos':
      // In most cases macos will be the same as ios - we can handle the edge cases in the future
      versionInfo = await getIOSVersionInfoAsync(projectRoot);
      break;
    default:
      versionInfo = null;
      break;
  }
  if (!versionInfo) {
    throw new ZephyrError(ZeErrors.ERR_MISSING_NATIVE_VERSION);
  }

  if (!isValidSemver(versionInfo.native_version)) {
    throw new ZephyrError(ZeErrors.ERR_INCORRECT_SEMVER_VERSION);
  }

  // In CI environments, try to augment with Git tag version
  return await augmentWithGitTagVersion(versionInfo, platform);
}
