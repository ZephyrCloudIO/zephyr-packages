import * as fs from 'fs';
import * as path from 'path';
import type { NativeVersionInfo } from '../../type/native-version';
import { logFn } from 'zephyr-agent';
import { DEFAULT_VERSION, DEFAULT_BUILD_NUMBER } from './ze-util-native-versions';

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
  const androidProjectPath = path.join(projectRoot, 'android');
  try {
    // Find build.gradle files that might contain version info
    const buildGradlePath = path.join(androidProjectPath, 'app/build.gradle');

    if (!fs.existsSync(buildGradlePath)) {
      logFn(
        'warn',
        `Could not find build.gradle at ${buildGradlePath}. Using default values for local development.`
      );
      return {
        native_version: DEFAULT_VERSION,
        native_build_number: DEFAULT_BUILD_NUMBER,
      };
    }

    const buildGradleContent = fs.readFileSync(buildGradlePath, 'utf-8');

    // Extract version name and version code using regex
    const versionNameMatch = buildGradleContent.match(/versionName ["'](.+?)["']/);
    const versionCodeMatch = buildGradleContent.match(/versionCode (\d+)/);

    if (!versionNameMatch) {
      logFn(
        'warn',
        `Could not find versionName in build.gradle. Using default "${DEFAULT_VERSION}" for local development.`
      );
    }

    if (!versionCodeMatch) {
      logFn(
        'warn',
        `Could not find versionCode in build.gradle. Using default "${DEFAULT_BUILD_NUMBER}" for local development.`
      );
    }

    const versionInfo = {
      native_version: versionNameMatch?.[1] || DEFAULT_VERSION,
      native_build_number: versionCodeMatch?.[1] || DEFAULT_BUILD_NUMBER,
    };

    return versionInfo;
  } catch (error) {
    logFn(
      'warn',
      `Error reading Android version info: ${error}. Using default values "${DEFAULT_VERSION}" for Native Version and "${DEFAULT_BUILD_NUMBER}" for Native Build Number during local development.`
    );
    return {
      native_version: DEFAULT_VERSION,
      native_build_number: DEFAULT_BUILD_NUMBER,
    };
  }
}
