import { ZeErrors, ZephyrError, logFn, ze_log } from 'zephyr-agent';
import { NativeVersionInfo, NativePlatform } from '../../type/native-version';
import * as child_process from 'child_process';
import * as util from 'util';
import isCI from 'is-ci';
import semverRegex from 'semver-regex';
import { getAndroidVersionInfoAsync } from './get-android-version';
import { getIOSVersionInfoAsync } from './get-ios-version';
import { getWindowsVersionInfoAsync } from './get-windows-info';

const exec = util.promisify(child_process.exec);

// Default values to use when version formatting is invalid
export const DEFAULT_VERSION = '0.0.1';
export const DEFAULT_BUILD_NUMBER = '1';

/**
 * Checks if a version string follows semantic versioning format (major.minor.patch)
 *
 * @param version The version string to check
 * @returns True if valid semver format, false otherwise
 */
export function isValidSemver(version: string): boolean {
  return semverRegex().test(version);
}

/**
 * Checks if a build number is a valid numeric format (pure number)
 *
 * @param buildNumber The build number string to check
 * @returns True if valid numeric format, false otherwise
 */
export function isValidBuildNumber(buildNumber: string): boolean {
  return /^\d+$/.test(buildNumber);
}

/**
 * Extracts a semver-compatible version from a Git tag
 *
 * @param tag The Git tag to parse
 * @returns A valid semver string or null if tag doesn't contain a valid semver
 */
export function extractSemverFromTag(tag: string): string | null {
  // Try to extract semver from the tag (common formats)
  // 1. Plain semver: v1.2.3 or 1.2.3
  const semverMatch = tag.match(semverRegex());
  if (semverMatch) {
    return semverMatch[0];
  }

  // 2. Tag with prefix like release-1.2.3 or version/1.2.3
  const prefixedMatch = tag.match(
    /(?:release-|version\/|v\/|ver-|ver\/|r-|r\/)(\d+\.\d+\.\d+)/i
  );
  if (prefixedMatch && prefixedMatch[1]) {
    return prefixedMatch[1];
  }

  // TODO: see if we need tag with platform prefix like ios-1.2.3 or android_1.2.3 or 1.2.3-ios or 1.2.3_android

  return null;
}

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
    const tags = stdout.trim().split('\n').filter(Boolean);

    if (!tags.length) {
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
        if (version) {
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
  let nativeVersion = versionInfo;
  if (!isCI) {
    if (!isValidSemver(versionInfo.native_version)) {
      logFn('warn', warningInfoLog(platform, 'native_version', versionInfo));

      nativeVersion = {
        ...nativeVersion,
        native_version: DEFAULT_VERSION,
      };
    }

    if (!isValidBuildNumber(versionInfo.native_build_number)) {
      logFn('warn', warningInfoLog(platform, 'native_build_number', versionInfo));

      nativeVersion = {
        ...nativeVersion,
        native_build_number: DEFAULT_BUILD_NUMBER,
      };
    }

    return nativeVersion;
  }

  // Try to get version from Git tag
  const gitTagVersion = await getGitTagVersion(platform);

  if (gitTagVersion) {
    // In CI environments, prefer Git tag version over manifest file version
    logFn(
      'info',
      `Using Git tag version ${gitTagVersion} for ${platform} in CI environment`
    );
    return {
      native_version: gitTagVersion,
      native_build_number: versionInfo.native_build_number, // Keep the build number from manifest
    };
  }

  return versionInfo;
}

// TODO: move this to zephyr-agent
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
  if (!projectRoot) {
    throw new Error('Project root directory is required');
  }

  let versionInfo: NativeVersionInfo;

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
      throw new ZephyrError(ZeErrors.ERR_MISSING_NATIVE_VERSION);
  }

  // In CI environments, try to augment with Git tag version
  return await augmentWithGitTagVersion(versionInfo, platform);
}

export function warningInfoLog(
  platform: NativePlatform,
  info: 'native_version' | 'native_build_number',
  versionInfo: NativeVersionInfo
): string {
  return `Invalid native ${info} "${versionInfo[info]}" for ${platform} as it is not a valid ${info}. Using default values "${DEFAULT_VERSION}" and "${DEFAULT_BUILD_NUMBER}" for local development.`;
}
