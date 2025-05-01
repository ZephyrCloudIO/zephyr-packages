import * as fs from 'fs';
import * as path from 'path';
import { NativeVersionInfo } from '../../type/native-version';
import { ze_log, ZeErrors, ZephyrError } from 'zephyr-agent';
import * as child_process from 'child_process';
import * as util from 'util';
const exec = util.promisify(child_process.exec);

/**
 * Get the native version and build information for macOS
 *
 * @param macOSProjectPath Path to the macOS project directory
 * @returns Object containing version and buildNumber
 */
export async function getMacOSVersionInfoAsync(
  projectRoot: string
): Promise<NativeVersionInfo> {
  const macOSProjectPath = path.join(projectRoot, 'macos');
  try {
    // Find Info.plist file - similar approach to iOS
    const infoPlistPaths = [
      path.join(macOSProjectPath, 'macos', 'Info.plist'),
      path.join(macOSProjectPath, 'Info.plist'),
    ];

    let infoPlistPath = '';
    for (const plistPath of infoPlistPaths) {
      if (fs.existsSync(plistPath)) {
        infoPlistPath = plistPath;
        break;
      }
    }

    if (!infoPlistPath) {
      throw new Error(`Could not find Info.plist in ${macOSProjectPath}`);
    }

    // Use PlistBuddy similar to iOS
    if (process.platform === 'darwin') {
      // On macOS, we can use PlistBuddy
      const versionCmd = `/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "${infoPlistPath}"`;
      const buildCmd = `/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "${infoPlistPath}"`;

      const { stdout: versionStdout } = await exec(versionCmd);
      const { stdout: buildStdout } = await exec(buildCmd);

      return {
        version: versionStdout.trim(),
        buildNumber: buildStdout.trim(),
      };
    } else {
      // Fallback to regex parsing like in the sync method
      const content = fs.readFileSync(infoPlistPath, 'utf8');

      const versionMatch = content.match(
        /<key>CFBundleShortVersionString<\/key>\s*<string>(.+?)<\/string>/
      );
      const buildMatch = content.match(
        /<key>CFBundleVersion<\/key>\s*<string>(.+?)<\/string>/
      );

      if (!versionMatch?.[1]) {
        throw new ZephyrError(ZeErrors.ERR_MISSING_MACOS_VERSION);
      }

      if (!buildMatch?.[1]) {
        throw new ZephyrError(ZeErrors.ERR_MISSING_MACOS_BUILD_NUMBER);
      }

      return {
        version: versionMatch?.[1],
        buildNumber: buildMatch?.[1],
      };
    }
  } catch (error) {
    ze_log('Error getting macOS version info:', error);
    return {
      version: '0.0.0',
      buildNumber: '0',
    };
  }
}

export function getMacOSVersionInfoSync(projectRoot: string): NativeVersionInfo {
  // For macOS, similar to iOS but with different path
  const macOSPath = path.join(projectRoot, 'macos');

  if (fs.existsSync(macOSPath)) {
    const infoPlistPaths = [
      path.join(macOSPath, 'Info.plist'),
      // Try to find app dir
      ...fs
        .readdirSync(macOSPath)
        .filter(
          (dir) =>
            fs.statSync(path.join(macOSPath, dir)).isDirectory() &&
            !dir.startsWith('.') &&
            dir !== 'Pods'
        )
        .map((dir) => path.join(macOSPath, dir, 'Info.plist')),
    ];

    for (const plistPath of infoPlistPaths) {
      if (fs.existsSync(plistPath)) {
        const content = fs.readFileSync(plistPath, 'utf8');

        const versionMatch = content.match(
          /<key>CFBundleShortVersionString<\/key>\s*<string>(.+?)<\/string>/
        );
        const buildMatch = content.match(
          /<key>CFBundleVersion<\/key>\s*<string>(.+?)<\/string>/
        );

        if (!versionMatch?.[1]) {
          throw new ZephyrError(ZeErrors.ERR_MISSING_MACOS_VERSION);
        }

        if (!buildMatch?.[1]) {
          throw new ZephyrError(ZeErrors.ERR_MISSING_MACOS_BUILD_NUMBER);
        }

        return {
          version: versionMatch?.[1],
          buildNumber: buildMatch?.[1],
        };
      }
    }
  }

  throw new ZephyrError(ZeErrors.ERR_MISSING_MACOS_VERSION);
}
