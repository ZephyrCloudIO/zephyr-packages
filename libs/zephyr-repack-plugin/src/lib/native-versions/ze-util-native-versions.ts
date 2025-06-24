import * as child_process from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import isCI from 'is-ci';
import * as path from 'path';
import * as util from 'util';
import {
  ZeErrors,
  ZephyrError,
  extractSemverFromTag,
  isValidSemver,
  logFn,
  ze_log,
} from 'zephyr-agent';
import type { NativePlatform, NativeVersionInfo } from '../../type/native-version';
import { getAndroidVersionInfoAsync } from './get-android-version';
import { getIOSVersionInfoAsync } from './get-ios-version';
import { getWindowsVersionInfoAsync } from './get-windows-info';

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
      ze_log.app('No git tags found for platform: ', platform);
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
      file_path: versionInfo.file_path,
      variable_name: versionInfo.variable_name,
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
    throw new ZephyrError(ZeErrors.ERR_INCORRECT_SEMVER_VERSION, {
      variable_name: versionInfo.variable_name,
      file_path: versionInfo.file_path,
      platform: platform as string,
      message: '',
    });
  }

  // In CI environments, try to augment with Git tag version
  return await augmentWithGitTagVersion(versionInfo, platform);
}

export interface DependencyHashes {
  // lockfileHash: string; // TODO: keep it one hash for now
  nativeConfigHash: string;
}

export async function getDependencyHashes(
  projectRoot: string,
  platform: NativePlatform
): Promise<DependencyHashes> {
  const hashes: DependencyHashes = {
    nativeConfigHash: '',
    // lockfileHash: '',
  };

  if (platform === 'ios') {
    // Hash Podfile.lock
    const podfileLockPath = path.join(projectRoot, 'ios', 'Podfile.lock');

    const podfilePath = path.join(projectRoot, 'ios', 'Podfile');

    ze_log.app('Podfile lock path.ios: ', podfileLockPath);
    if (fs.existsSync(podfileLockPath) || fs.existsSync(podfilePath)) {
      const content = fs.readFileSync(podfileLockPath, 'utf8');
      hashes.nativeConfigHash = crypto
        .createHash('sha256')
        .update(content.length ? content : Buffer.from(podfileLockPath, 'utf8'))
        .digest('hex');
      ze_log.app('Podfile lock hash.ios: ', hashes.nativeConfigHash);
    }
  }

  if (platform === 'android') {
    // Hash build.gradle files
    // look for gradle.lockfile first, if not found then look for build.gradle
    // gradle.lockfile would require user to run `./gradlew dependencies --write-locks` and add dependencyLocking with `lockAllConfiguration()`

    const gradleLockPath = path.join(projectRoot, 'android', 'gradle.lockfile');
    const gradlePath = path.join(projectRoot, 'android', 'app', 'build.gradle');

    ze_log.app('Gradle path.android: ', gradlePath);
    if (fs.existsSync(gradleLockPath) || fs.existsSync(gradlePath)) {
      const content = fs.readFileSync(gradlePath ? gradlePath : gradleLockPath, 'utf8');
      hashes.nativeConfigHash = fs.existsSync(gradleLockPath)
        ? crypto.createHash('sha256').update(content).digest('hex')
        : crypto
            .createHash('sha256')
            .update(content.length ? content : Buffer.from(gradleLockPath, 'utf8'))
            .digest('hex');
      ze_log.app('Gradle hash.android: ', hashes.nativeConfigHash);
    }
  }
  ze_log.app('Native config file hash: ', hashes.nativeConfigHash);
  // If no native related lockfile found, then return nothing
  return hashes;
}
