import * as fs from 'fs';
import * as path from 'path';
import { isValidSemver, ze_log, ZeErrors, ZephyrError } from 'zephyr-agent';
import type { NativeVersionInfo } from '../../type/native-version';

/**
 * Attempts to extract version information from a project.pbxproj file
 *
 * @param pbxprojContent The content of the project.pbxproj file
 * @returns Object containing version and build number, or null if parsing fails
 */
function parseProjectPbxprojContent(
  pbxprojContent: string
): { native_version: string; native_build_number: string } | null {
  // Look for MARKETING_VERSION and CURRENT_PROJECT_VERSION in build configurations
  const nativeVersionMatch = pbxprojContent.match(/MARKETING_VERSION = ([^;]+);/);
  const buildVersionMatch = pbxprojContent.match(/CURRENT_PROJECT_VERSION = ([^;]+);/);

  if (!nativeVersionMatch?.[1]) {
    throw new ZephyrError(ZeErrors.ERR_MISSING_IOS_VERSION);
  }

  const formattedNativeVersion = nativeVersionMatch?.[1]?.trim().replace(/"/g, '');

  if (!isValidSemver(formattedNativeVersion)) {
    throw new ZephyrError(ZeErrors.ERR_INCORRECT_SEMVER_VERSION);
  }

  if (!buildVersionMatch?.[1]) {
    throw new ZephyrError(ZeErrors.ERR_MISSING_IOS_BUILD_NUMBER);
  }

  const formattedBuildVersion = buildVersionMatch?.[1]?.trim().replace(/"/g, '');

  return {
    native_version: formattedNativeVersion,
    native_build_number: formattedBuildVersion,
  };
}

/**
 * Find project.pbxproj files recursively within the iOS project directory
 *
 * @param dir Directory to search in
 * @returns Path to the first project.pbxproj file found, or null if none found
 */
function findProjectPbxproj(dir: string): string | null {
  try {
    // Check if directory exists
    if (!fs.existsSync(dir)) {
      return null;
    }

    // Look for .xcodeproj directories directly in the iOS directory
    const xcodeprojDirs = fs
      .readdirSync(dir)
      .filter(
        (item) =>
          fs.statSync(path.join(dir, item)).isDirectory() &&
          item.endsWith('.xcodeproj') &&
          !item.startsWith('.')
      );

    // Check each .xcodeproj directory for a project.pbxproj file
    for (const xcodeprojDir of xcodeprojDirs) {
      const pbxprojPath = path.join(dir, xcodeprojDir, 'project.pbxproj');
      if (fs.existsSync(pbxprojPath)) {
        return pbxprojPath;
      }
    }

    // If not found directly, look in subdirectories (excluding node_modules and Pods)
    const subdirs = fs
      .readdirSync(dir)
      .filter(
        (item) =>
          fs.statSync(path.join(dir, item)).isDirectory() &&
          !item.startsWith('.') &&
          item !== 'Pods' &&
          item !== 'node_modules' &&
          !item.endsWith('.xcodeproj')
      );

    for (const subdir of subdirs) {
      const pbxprojPath = findProjectPbxproj(path.join(dir, subdir));
      if (pbxprojPath) {
        return pbxprojPath;
      }
    }

    return null;
  } catch (err) {
    ze_log.app('Error finding project.pbxproj', err);
    return null;
  }
}

/**
 * Get the native version and build information for iOS This function extracts version
 * info from project.pbxproj file
 *
 * @param projectRoot Path to the project root directory
 * @returns Object containing native_version and native_build_number
 */
export async function getIOSVersionInfoAsync(
  projectRoot: string
): Promise<NativeVersionInfo> {
  const iosProjectPath = path.join(projectRoot, 'ios');

  // Try to find project.pbxproj file
  const pbxprojPath = findProjectPbxproj(iosProjectPath);

  if (pbxprojPath && fs.existsSync(pbxprojPath)) {
    ze_log.app('Found project.pbxproj at', pbxprojPath);

    // Read the project.pbxproj file content
    const pbxprojContent = fs.readFileSync(pbxprojPath, 'utf8');

    // Try to extract version info from project.pbxproj
    const info = parseProjectPbxprojContent(pbxprojContent);

    if (!info) {
      throw new ZephyrError(ZeErrors.ERR_MISSING_IOS_VERSION);
    }

    // we only worry about native version here
    if (!isValidSemver(info?.native_version)) {
      throw new ZephyrError(ZeErrors.ERR_INCORRECT_SEMVER_VERSION);
    }

    ze_log.app('Successfully extracted version info from project.pbxproj');
    ze_log.app('iOS marketing version', info.native_version);
    ze_log.app('iOS current project version', info.native_build_number);
    return {
      native_version: info.native_version,
      native_build_number: info.native_build_number,
      file_path: pbxprojPath,
      variable_name: 'MARKETING_VERSION',
    };
  }
  throw new ZephyrError(ZeErrors.ERR_MISSING_IOS_VERSION);
}
