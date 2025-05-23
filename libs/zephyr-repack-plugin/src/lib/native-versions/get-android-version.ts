import * as fs from 'fs';
import * as path from 'path';
import { ZeErrors, ZephyrError } from 'zephyr-agent';
import type { NativeVersionInfo } from '../../type/native-version';

/**
 * Get the native version and build information for Android Extracts version from
 * build.gradle and validates it
 *
 * @param projectRoot Path to the project root directory
 * @returns Object containing native_version and native_build_number
 */
export async function getAndroidVersionInfoAsync(
  projectRoot: string
): Promise<NativeVersionInfo> {
  let buildGradlePath = '';
  const androidProjectPath = path.join(projectRoot, 'android');
  try {
    // Find build.gradle files that might contain version info
    buildGradlePath = path.join(androidProjectPath, 'app/build.gradle');

    if (!fs.existsSync(buildGradlePath)) {
      throw new ZephyrError(ZeErrors.ERR_INCORRECT_SEMVER_VERSION, {
        variable_name: 'versionName',
        file_path: buildGradlePath,
        platform: 'android',
      });
    }

    const buildGradleContent = fs.readFileSync(buildGradlePath, 'utf-8');

    // Extract version name and version code using regex
    const versionNameMatch = buildGradleContent.match(/versionName ["'](.+?)["']/);
    const versionCodeMatch = buildGradleContent.match(/versionCode (\d+)/);

    if (!versionNameMatch) {
      throw new ZephyrError(ZeErrors.ERR_INCORRECT_SEMVER_VERSION, {
        variable_name: 'versionName',
        file_path: buildGradlePath,
        platform: 'android',
      });
    }

    if (!versionCodeMatch) {
      throw new ZephyrError(ZeErrors.ERR_INCORRECT_SEMVER_VERSION, {
        variable_name: 'versionCode',
        file_path: buildGradlePath,
        platform: 'android',
      });
    }

    const versionInfo = {
      native_version: versionNameMatch?.[1],
      native_build_number: versionCodeMatch?.[1],
    };

    return {
      native_version: versionInfo.native_version,
      native_build_number: versionInfo.native_build_number,
      file_path: buildGradlePath,
      variable_name: 'versionName',
    };
  } catch (error) {
    throw new ZephyrError(ZeErrors.ERR_INCORRECT_SEMVER_VERSION, {
      platform: 'android',
      variable_name: 'versionName',
      file_path: buildGradlePath,
    });
  }
}
