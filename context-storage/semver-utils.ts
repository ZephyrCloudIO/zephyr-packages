/**
 * Semver Utilities for Zephyr
 * 
 * This file provides utility functions for working with semantic versions,
 * including parsing, comparison, and range validation.
 */

import { SemverVersion, SemverRange, SemverResolutionError } from './semver-types';

/**
 * Regular expression for parsing semver versions
 * Matches: MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
 */
const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Parses a version string into a SemverVersion object
 */
export function parseVersion(version: string): SemverVersion | null {
  const match = SEMVER_REGEX.exec(version);
  if (!match) {
    return null;
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    buildMetadata: match[5]
  };
}

/**
 * Compares two semantic versions
 * Returns:
 * - negative number if v1 < v2
 * - 0 if v1 == v2
 * - positive number if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const version1 = parseVersion(v1);
  const version2 = parseVersion(v2);

  if (!version1 || !version2) {
    throw new Error(`Invalid version format: ${!version1 ? v1 : v2}`);
  }

  // Compare major.minor.patch
  const majorDiff = version1.major - version2.major;
  if (majorDiff !== 0) return majorDiff;

  const minorDiff = version1.minor - version2.minor;
  if (minorDiff !== 0) return minorDiff;

  const patchDiff = version1.patch - version2.patch;
  if (patchDiff !== 0) return patchDiff;

  // If we get here, we need to compare prerelease versions
  // No prerelease means higher precedence than any prerelease
  if (!version1.prerelease && !version2.prerelease) return 0;
  if (!version1.prerelease) return 1;
  if (!version2.prerelease) return -1;

  // Compare prerelease identifiers
  const prerelease1 = version1.prerelease.split('.');
  const prerelease2 = version2.prerelease.split('.');

  const minLength = Math.min(prerelease1.length, prerelease2.length);

  for (let i = 0; i < minLength; i++) {
    const isNum1 = /^\d+$/.test(prerelease1[i]);
    const isNum2 = /^\d+$/.test(prerelease2[i]);

    // Numeric identifiers have lower precedence than non-numeric identifiers
    if (isNum1 && !isNum2) return -1;
    if (!isNum1 && isNum2) return 1;

    // Compare numeric identifiers numerically, other identifiers lexicographically
    if (isNum1 && isNum2) {
      const diff = parseInt(prerelease1[i], 10) - parseInt(prerelease2[i], 10);
      if (diff !== 0) return diff;
    } else {
      const diff = prerelease1[i].localeCompare(prerelease2[i]);
      if (diff !== 0) return diff;
    }
  }

  // If we get here, one prerelease array is a prefix of the other
  // The shorter one has higher precedence
  return prerelease1.length - prerelease2.length;
}

/**
 * Checks if a version satisfies a version range
 */
export function satisfiesRange(version: string, range: SemverRange): boolean {
  // Handle exact version match
  if (range === version) {
    return true;
  }

  const parsedVersion = parseVersion(version);
  if (!parsedVersion) {
    return false;
  }

  // Handle caret ranges (^) - compatible with left-most non-zero digit
  if (range.startsWith('^')) {
    const rangeVersion = parseVersion(range.substring(1));
    if (!rangeVersion) {
      return false;
    }

    // ^0.x.x --> Only allow patches in 0.x.x
    if (rangeVersion.major === 0) {
      return parsedVersion.major === 0 && 
             parsedVersion.minor === rangeVersion.minor &&
             parsedVersion.patch >= rangeVersion.patch;
    }

    // ^x.y.z --> Allow anything that doesn't change the leftmost non-zero digit
    return parsedVersion.major === rangeVersion.major &&
           (parsedVersion.minor > rangeVersion.minor || 
           (parsedVersion.minor === rangeVersion.minor && 
            parsedVersion.patch >= rangeVersion.patch));
  }

  // Handle tilde ranges (~) - allow patch-level changes
  if (range.startsWith('~')) {
    const rangeVersion = parseVersion(range.substring(1));
    if (!rangeVersion) {
      return false;
    }

    return parsedVersion.major === rangeVersion.major &&
           parsedVersion.minor === rangeVersion.minor &&
           parsedVersion.patch >= rangeVersion.patch;
  }

  // Handle inequality ranges
  if (range.includes(' - ')) {
    const [lowerBound, upperBound] = range.split(' - ');
    const lowerVersion = parseVersion(lowerBound);
    const upperVersion = parseVersion(upperBound);

    if (!lowerVersion || !upperVersion) {
      return false;
    }

    return compareVersions(version, lowerBound) >= 0 && 
           compareVersions(version, upperBound) <= 0;
  }

  // Handle complex ranges (e.g., >=1.0.0 <2.0.0)
  if (range.includes(' ')) {
    const conditions = range.split(' ');
    return conditions.every(condition => {
      if (condition.startsWith('>=')) {
        return compareVersions(version, condition.substring(2)) >= 0;
      }
      if (condition.startsWith('>')) {
        return compareVersions(version, condition.substring(1)) > 0;
      }
      if (condition.startsWith('<=')) {
        return compareVersions(version, condition.substring(2)) <= 0;
      }
      if (condition.startsWith('<')) {
        return compareVersions(version, condition.substring(1)) < 0;
      }
      if (condition.startsWith('=')) {
        return compareVersions(version, condition.substring(1)) === 0;
      }
      // If no operator, assume exact match
      return compareVersions(version, condition) === 0;
    });
  }

  // Handle simple operators
  if (range.startsWith('>=')) {
    return compareVersions(version, range.substring(2)) >= 0;
  }
  if (range.startsWith('>')) {
    return compareVersions(version, range.substring(1)) > 0;
  }
  if (range.startsWith('<=')) {
    return compareVersions(version, range.substring(2)) <= 0;
  }
  if (range.startsWith('<')) {
    return compareVersions(version, range.substring(1)) < 0;
  }
  if (range.startsWith('=')) {
    return compareVersions(version, range.substring(1)) === 0;
  }

  // For any other range format, assume exact match
  return compareVersions(version, range) === 0;
}

/**
 * Filters an array of versions to those that satisfy the given range
 */
export function filterSatisfyingVersions(
  versions: string[], 
  range: SemverRange, 
  includePrerelease = false
): string[] {
  return versions
    .filter(v => {
      const parsed = parseVersion(v);
      return parsed && (includePrerelease || !parsed.prerelease) && satisfiesRange(v, range);
    })
    .sort((a, b) => compareVersions(a, b));
}

/**
 * Finds the highest version that satisfies the given range
 */
export function findHighestSatisfyingVersion(
  versions: string[], 
  range: SemverRange, 
  includePrerelease = false
): string | null {
  const satisfying = filterSatisfyingVersions(versions, range, includePrerelease);
  return satisfying.length > 0 ? satisfying[satisfying.length - 1] : null;
}

/**
 * Finds the lowest version that satisfies the given range
 */
export function findLowestSatisfyingVersion(
  versions: string[], 
  range: SemverRange, 
  includePrerelease = false
): string | null {
  const satisfying = filterSatisfyingVersions(versions, range, includePrerelease);
  return satisfying.length > 0 ? satisfying[0] : null;
}

/**
 * Checks if two semver ranges are compatible (have an intersection)
 */
export function areRangesCompatible(range1: SemverRange, range2: SemverRange): boolean {
  // This is a simplified implementation - in a real-world scenario,
  // you would need a more comprehensive solution with actual range parsing
  
  // Generate some test versions to check compatibility
  const testVersions = [
    '0.1.0', '0.1.1', '0.2.0', 
    '1.0.0', '1.0.1', '1.1.0', '1.2.0', 
    '2.0.0', '2.1.0', '3.0.0'
  ];
  
  // Find versions that satisfy both ranges
  const compatible = testVersions.some(version => 
    satisfiesRange(version, range1) && satisfiesRange(version, range2)
  );
  
  return compatible;
}

/**
 * Finds a common version that satisfies multiple semver ranges
 */
export function findCommonVersion(
  ranges: SemverRange[], 
  availableVersions: string[],
  preferHighest = true,
  includePrerelease = false
): string | null {
  // Filter versions that satisfy all ranges
  const satisfyingVersions = availableVersions.filter(version => {
    const parsed = parseVersion(version);
    return parsed && 
           (includePrerelease || !parsed.prerelease) && 
           ranges.every(range => satisfiesRange(version, range));
  });
  
  if (satisfyingVersions.length === 0) {
    return null;
  }
  
  // Sort versions
  satisfyingVersions.sort((a, b) => compareVersions(a, b));
  
  // Return highest or lowest based on preference
  return preferHighest 
    ? satisfyingVersions[satisfyingVersions.length - 1] 
    : satisfyingVersions[0];
}

/**
 * Formats a SemverVersion object into a string
 */
export function formatVersion(version: SemverVersion): string {
  let result = `${version.major}.${version.minor}.${version.patch}`;
  if (version.prerelease) {
    result += `-${version.prerelease}`;
  }
  if (version.buildMetadata) {
    result += `+${version.buildMetadata}`;
  }
  return result;
}

/**
 * Increments a version based on the specified release type
 */
export function incrementVersion(
  version: string, 
  releaseType: 'major' | 'minor' | 'patch' | 'prerelease',
  prereleaseId?: string
): string {
  const parsed = parseVersion(version);
  if (!parsed) {
    throw new Error(`Invalid version format: ${version}`);
  }
  
  const result = { ...parsed };
  
  switch (releaseType) {
    case 'major':
      result.major += 1;
      result.minor = 0;
      result.patch = 0;
      result.prerelease = undefined;
      break;
    case 'minor':
      result.minor += 1;
      result.patch = 0;
      result.prerelease = undefined;
      break;
    case 'patch':
      result.patch += 1;
      result.prerelease = undefined;
      break;
    case 'prerelease':
      if (result.prerelease) {
        // Increment the prerelease number if it's numeric
        const parts = result.prerelease.split('.');
        const lastPart = parts[parts.length - 1];
        if (/^\d+$/.test(lastPart)) {
          parts[parts.length - 1] = String(parseInt(lastPart, 10) + 1);
          result.prerelease = parts.join('.');
        } else {
          result.prerelease += '.1';
        }
      } else {
        // Start a new prerelease
        result.patch += 1;
        result.prerelease = prereleaseId || 'alpha.0';
      }
      break;
  }
  
  return formatVersion(result);
}