import * as fs from 'fs';
import * as path from 'path';
import { NativeVersionInfo } from '../../type/native-version';
import { ZeErrors } from 'zephyr-agent';
import { ZephyrError } from 'zephyr-agent';

/**
 * Get the native version and build information for Android
 *
 * @param androidProjectPath Path to the Android project directory
 * @returns Object containing version and buildNumber
 */
export async function getAndroidVersionInfoAsync(
  projectRoot: string
): Promise<NativeVersionInfo> {
  const androidProjectPath = path.join(projectRoot, 'android');
  try {
    // Find build.gradle files that might contain version info
    const buildGradlePath = path.join(androidProjectPath, 'app/build.gradle');

    if (!fs.existsSync(buildGradlePath)) {
      throw new Error(`Could not find build.gradle at ${buildGradlePath}`);
    }

    const buildGradleContent = fs.readFileSync(buildGradlePath, 'utf-8');

    // Extract version name and version code using regex
    const versionNameMatch = buildGradleContent.match(/versionName ["'](.+?)["']/);
    const versionCodeMatch = buildGradleContent.match(/versionCode (\d+)/);

    return {
      version: versionNameMatch?.[1] || '0.0.0',
      buildNumber: versionCodeMatch?.[1] || '0',
    };
  } catch (error) {
    console.error('Error getting Android version info:', error);
    return {
      version: '0.0.0',
      buildNumber: '0',
    };
  }
}

export function getAndroidVersionInfoSync(projectRoot: string): NativeVersionInfo {
  const androidPath = path.join(projectRoot, 'android');
  const buildGradlePath = path.join(androidPath, 'app', 'build.gradle');
  if (fs.existsSync(buildGradlePath)) {
    const content = fs.readFileSync(buildGradlePath, 'utf8');
    const versionNameMatch = content.match(/versionName ["'](.+?)["']/);
    const versionCodeMatch = content.match(/versionCode (\d+)/);

    if (!versionNameMatch?.[1]) {
      throw new ZephyrError(ZeErrors.ERR_MISSING_ANDROID_VERSION);
    }

    if (!versionCodeMatch?.[1]) {
      throw new ZephyrError(ZeErrors.ERR_MISSING_ANDROID_BUILD_NUMBER);
    }

    return {
      version: versionNameMatch?.[1],
      buildNumber: versionCodeMatch?.[1],
    };
  }

  throw new ZephyrError(ZeErrors.ERR_MISSING_ANDROID_VERSION);
}
