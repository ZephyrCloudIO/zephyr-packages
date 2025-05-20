import semverRegex from 'semver-regex';

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

  // TODO: see if we need tag with platform prefix like ios-1.2.3 or android_1.2.3 or 1.2.3-ios or 1.2.3_android

  return null;
}
