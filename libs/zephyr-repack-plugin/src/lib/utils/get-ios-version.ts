import * as child_process from 'child_process';
import type { NativeVersionInfo } from '../../type/native-version';
import * as fs from 'fs';
import { ze_log, logFn, ZeErrors, ZephyrError } from 'zephyr-agent';
import * as util from 'util';
import * as path from 'path';
import { DEFAULT_VERSION, DEFAULT_BUILD_NUMBER } from './ze-util-native-versions';

const exec = util.promisify(child_process.exec);

// Using imported constants and validation functions from ze-util-native-versions.ts

/**
 * Attempts to extract version information from Info.plist file content directly
 *
 * @param plistContent The content of the Info.plist file
 * @returns Object containing version and build number, or null if parsing fails
 */
function parseInfoPlistContent(
  plistContent: string
): { native_version: string; native_build_number: string } | null {
  try {
    const versionMatch = plistContent.match(
      /<key>CFBundleShortVersionString<\/key>\s*<string>(.+?)<\/string>/
    );
    const buildMatch = plistContent.match(
      /<key>CFBundleVersion<\/key>\s*<string>(.+?)<\/string>/
    );

    if (!versionMatch?.[1] && !buildMatch?.[1]) {
      return null;
    }

    return {
      native_version: versionMatch?.[1] || DEFAULT_VERSION,
      native_build_number: buildMatch?.[1] || DEFAULT_BUILD_NUMBER,
    };
  } catch (err) {
    throw new ZephyrError(ZeErrors.ERR_MISSING_IOS_VERSION, {
      cause: err,
    });
  }
}

/**
 * Attempts to check if PlistBuddy is available on the system
 *
 * @returns Promise resolving to true if available, false otherwise
 */
async function isPlistBuddyAvailable(): Promise<boolean> {
  try {
    await exec('which /usr/libexec/PlistBuddy');
    return true;
  } catch (err) {
    ze_log('Error finding PlistBuddy. Fallback to regular parsing of Info.plist', err);
    return false;
  }
}

/**
 * Attempts to extract version and build number using PlistBuddy
 *
 * @param infoPlistPath Path to Info.plist file
 * @returns Object containing version and build number, or null if extraction fails
 */
async function extractVersionUsingPlistBuddy(
  infoPlistPath: string
): Promise<{ native_version: string; native_build_number: string } | null> {
  try {
    const versionCmd = `/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "${infoPlistPath}"`;
    const buildCmd = `/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "${infoPlistPath}"`;

    const [versionResult, buildResult] = await Promise.all([
      exec(versionCmd).catch(() => ({ stdout: '' })),
      exec(buildCmd).catch(() => ({ stdout: '' })),
    ]);

    const version = versionResult.stdout?.trim();
    const buildNumber = buildResult.stdout?.trim();

    if (!version && !buildNumber) {
      return null;
    }

    return {
      native_version: version || DEFAULT_VERSION,
      native_build_number: buildNumber || DEFAULT_BUILD_NUMBER,
    };
  } catch (err) {
    throw new ZephyrError(ZeErrors.ERR_MISSING_IOS_VERSION, {
      cause: err,
    });
  }
}

/**
 * Find Info.plist file using Node.js APIs (fallback for Windows or systems without
 * find/grep)
 *
 * @param dir Directory to search in
 * @returns Path to the first Info.plist file found, or null if none found
 */
async function findInfoPlistNodeJS(dir: string): Promise<string | null> {
  try {
    // Check if directory exists
    if (!fs.existsSync(dir)) {
      return null;
    }

    // Basic structure of typical iOS project
    const appDirs = fs
      .readdirSync(dir)
      .filter(
        (item) =>
          fs.statSync(path.join(dir, item)).isDirectory() &&
          !item.startsWith('.') &&
          item !== 'Pods' &&
          item !== 'build'
      );

    for (const appDir of appDirs) {
      const infoPlistPath = path.join(dir, appDir, 'Info.plist');
      if (fs.existsSync(infoPlistPath)) {
        return infoPlistPath;
      }
    }

    return null;
  } catch (err) {
    throw new ZephyrError(ZeErrors.ERR_MISSING_IOS_VERSION, {
      cause: err,
    });
  }
}

/**
 * Get the native version and build information for iOS This function is platform-agnostic
 * and will work on any OS, falling back to different methods if PlistBuddy or find/grep
 * are not available
 *
 * @param projectRoot Path to the project root directory
 * @returns Object containing native_version and native_build_number
 */
export async function getIOSVersionInfoAsync(
  projectRoot: string
): Promise<NativeVersionInfo> {
  const iosProjectPath = path.join(projectRoot, 'ios');
  try {
    // Try to find Info.plist files using command line tools first
    const infoPlistPath = await findInfoPlistNodeJS(iosProjectPath);

    if (!infoPlistPath || !fs.existsSync(infoPlistPath)) {
      throw new ZephyrError(
        ZeErrors.ERR_MISSING_IOS_VERSION,
        `Couldn't find Info.plist file in ${iosProjectPath}. Please ensure you are using zephyr-repack-plugin in a valid React Native project.`
      );
    }

    // Read the plist file content first (used as fallback)
    const plistContent = fs.readFileSync(infoPlistPath, 'utf8');

    // Try using PlistBuddy if available (preferred method)
    const hasPlistBuddy = await isPlistBuddyAvailable();
    let versionInfo = null;

    // If PlistBuddy failed or isn't available, fall back to regex parsing
    if (!hasPlistBuddy) {
      versionInfo = parseInfoPlistContent(plistContent);
    }

    versionInfo = await extractVersionUsingPlistBuddy(infoPlistPath);

    // If both methods failed, use defaults
    if (!versionInfo) {
      logFn(
        'warn',
        `Failed to extract version info from Info.plist. Using default values "${DEFAULT_VERSION}" for Native Version and "${DEFAULT_BUILD_NUMBER}" for Native Build Number during local development.`
      );
      return {
        native_version: DEFAULT_VERSION,
        native_build_number: DEFAULT_BUILD_NUMBER,
      };
    }

    ze_log('ios bundle short version string', versionInfo.native_version);
    ze_log('ios bundle version', versionInfo.native_build_number);

    // Validate and normalize the version information
    return versionInfo;
  } catch (error) {
    logFn(
      'warn',
      `Error reading iOS version info: ${error}. Using default values "${DEFAULT_VERSION}" for Native Version and "${DEFAULT_BUILD_NUMBER}" for Native Build Number during local development.`
    );
    return {
      native_version: DEFAULT_VERSION,
      native_build_number: DEFAULT_BUILD_NUMBER,
    };
  }
}
