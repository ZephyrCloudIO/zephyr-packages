import * as child_process from 'child_process';
import { NativeVersionInfo } from '../../type/native-version';
import * as fs from 'fs';
import { ZeErrors, ZephyrError } from 'zephyr-agent';
import * as util from 'util';
import * as path from 'path';

const exec = util.promisify(child_process.exec);

/**
 * Get the native version and build information for iOS
 *
 * @param iosProjectPath Path to the iOS project directory
 * @returns Object containing version and buildNumber
 */
export async function getIOSVersionInfoAsync(
  projectRoot: string
): Promise<NativeVersionInfo> {
  const iosProjectPath = path.join(projectRoot, 'ios');
  try {
    // Find Info.plist files in the project directory
    const { stdout } = await exec(
      `find "${iosProjectPath}" -name "Info.plist" | grep -v "build" | head -1`
    );
    const infoPlistPath = stdout.trim();

    if (!infoPlistPath || !fs.existsSync(infoPlistPath)) {
      throw new Error(`Could not find Info.plist in ${iosProjectPath}`);
    }

    // Extract version and build number using PlistBuddy
    const versionCmd = `/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "${infoPlistPath}"`;
    const buildCmd = `/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "${infoPlistPath}"`;

    const { stdout: versionStdout } = await exec(versionCmd);
    const { stdout: buildStdout } = await exec(buildCmd);

    if (!versionStdout.trim()) {
      throw new ZephyrError(ZeErrors.ERR_MISSING_IOS_VERSION);
    }

    if (!buildStdout.trim()) {
      throw new ZephyrError(ZeErrors.ERR_MISSING_IOS_BUILD_NUMBER);
    }

    return {
      version: versionStdout.trim(),
      buildNumber: buildStdout.trim(),
    };
  } catch (error) {
    throw new ZephyrError(ZeErrors.ERR_MISSING_IOS_VERSION, { cause: error });
  }
}

export function getIOSVersionInfoSync(iosProjectPath: string): NativeVersionInfo {
  // For iOS, we'll try to find the main Info.plist file
  const iosPath = path.join(iosProjectPath, 'ios');
  const appDirs = fs
    .readdirSync(iosPath)
    .filter(
      (dir) =>
        fs.statSync(path.join(iosPath, dir)).isDirectory() &&
        !dir.startsWith('.') &&
        dir !== 'Pods'
    );

  if (appDirs.length === 0 || !appDirs) {
    throw new ZephyrError(ZeErrors.ERR_MISSING_IOS_VERSION);
  }

  while (appDirs.length > 0) {
    const appDir = appDirs.shift();
    if (!appDir) {
      throw new ZephyrError(ZeErrors.ERR_MISSING_IOS_PROJECT_PATH);
    }
    const infoPlistPath = path.join(iosPath, appDir, 'Info.plist');
    if (fs.existsSync(infoPlistPath)) {
      const content = fs.readFileSync(infoPlistPath, 'utf8');

      // Simple regex parsing of plist file
      const versionMatch = content.match(
        /<key>CFBundleShortVersionString<\/key>\s*<string>(.+?)<\/string>/
      );
      const buildMatch = content.match(
        /<key>CFBundleVersion<\/key>\s*<string>(.+?)<\/string>/
      );

      if (!versionMatch?.[1]) {
        throw new ZephyrError(ZeErrors.ERR_MISSING_IOS_VERSION);
      }

      if (!buildMatch?.[1]) {
        throw new ZephyrError(ZeErrors.ERR_MISSING_IOS_BUILD_NUMBER);
      }

      return {
        version: versionMatch?.[1],
        buildNumber: buildMatch?.[1],
      };
    }
  }

  // If we get here, no valid Info.plist was found
  throw new ZephyrError(ZeErrors.ERR_MISSING_IOS_VERSION);
}
