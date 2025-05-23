import * as fs from 'fs';
import * as path from 'path';
import { ZeErrors, ZephyrError } from 'zephyr-agent';
import type { NativeVersionInfo } from '../../type/native-version';

/**
 * Parse a Windows app manifest file to extract version information
 *
 * @param manifestPath Path to the Package.appxmanifest file
 * @returns Object containing version and buildNumber
 */
export function parseWindowsManifest(manifestPath: string): NativeVersionInfo {
  const content = fs.readFileSync(manifestPath, 'utf-8');

  // Look for Version attribute in the Identity element
  // Example: <Identity Name="MyApp" Version="1.0.0.0" ...>
  const versionMatch = content.match(/Identity[^>]*Version="([^"]+)"/i);

  if (versionMatch && versionMatch[1]) {
    const fullVersion = versionMatch[1];
    const parts = fullVersion.split('.');

    // Windows uses 4-part version numbers: Major.Minor.Build.Revision
    // We'll use Major.Minor.Build as the version and the full string as buildNumber
    if (parts.length >= 3) {
      return {
        native_version: parts.slice(0, 3).join('.'),
        native_build_number: fullVersion,
        file_path: manifestPath,
        variable_name: 'Version',
      };
    }

    return {
      native_version: fullVersion,
      native_build_number: fullVersion,
      file_path: manifestPath,
      variable_name: 'Version',
    };
  }

  throw new ZephyrError(ZeErrors.ERR_INCORRECT_SEMVER_VERSION, {
    variable_name: 'Version',
    file_path: manifestPath,
    platform: 'windows',
  });
}

/**
 * Get the native version and build information for Windows
 *
 * @param windowsProjectPath Path to the Windows project directory
 * @returns Object containing version and buildNumber
 */
export async function getWindowsVersionInfoAsync(
  projectRoot: string
): Promise<NativeVersionInfo> {
  const windowsPath = path.join(projectRoot, 'windows');
  try {
    // Look for Package.appxmanifest file which contains version info for Windows apps
    const manifestPath = path.join(windowsPath, 'app', 'Package.appxmanifest');

    if (!fs.existsSync(manifestPath)) {
      // Try alternative location
      const altManifestPath = path.join(windowsPath, 'app', 'Package.appxmanifest');
      if (fs.existsSync(altManifestPath)) {
        return parseWindowsManifest(altManifestPath);
      }

      throw new ZephyrError(ZeErrors.ERR_MISSING_WINDOWS_VERSION, {
        cause: new Error(`Could not find Package.appxmanifest at ${manifestPath}`),
      });
    }
    return parseWindowsManifest(manifestPath);
  } catch (error) {
    throw new ZephyrError(ZeErrors.ERR_MISSING_WINDOWS_VERSION, {
      cause: error,
    });
  }
}
