import type { ParsedZephyrDependency, ZephyrDependencyConfig } from '../types';

/**
 * Parse a zephyr: protocol string into its components
 *
 * @param value - The zephyr protocol string (e.g., "zephyr:appName.projectName.orgName@staging")
 * @returns Parsed dependency info or null if invalid format
 *
 * @example
 * parseZephyrProtocol("zephyr:mftexteditor.myproject.myorg@staging")
 * // Returns: { applicationUid: "mftexteditor.myproject.myorg", versionTag: "staging" }
 */
export function parseZephyrProtocol(
  value: string
): { applicationUid: string; versionTag: string } | null {
  // Match pattern: zephyr:applicationUid@versionTag
  const match = value.match(/^zephyr:(.+)@(.+)$/);
  if (!match) {
    return null;
  }

  return {
    applicationUid: match[1],
    versionTag: match[2],
  };
}

/**
 * Parse a single zephyr dependency entry
 *
 * @param name - The remote name (key in the dependencies config)
 * @param value - The zephyr protocol string
 * @returns Parsed dependency or null if invalid
 *
 * @example
 * parseZephyrDependency("MFTextEditor", "zephyr:mftexteditor.myproject.myorg@staging")
 * // Returns: {
 * //   name: "MFTextEditor",
 * //   applicationUid: "mftexteditor.myproject.myorg",
 * //   versionTag: "staging"
 * // }
 */
export function parseZephyrDependency(
  name: string,
  value: string
): ParsedZephyrDependency | null {
  const parsed = parseZephyrProtocol(value);
  if (!parsed) {
    return null;
  }

  return {
    name,
    ...parsed,
  };
}

/**
 * Parse all zephyr dependencies from a config object
 *
 * @param dependencies - Map of remote names to zephyr protocol strings
 * @returns Array of parsed dependencies (invalid entries are filtered out)
 *
 * @example
 * parseZephyrDependencies({
 *   MFTextEditor: "zephyr:mftexteditor.myproject.myorg@staging",
 *   MFNotesList: "zephyr:mfnoteslist.myproject.myorg@staging",
 * })
 */
export function parseZephyrDependencies(
  dependencies: ZephyrDependencyConfig
): ParsedZephyrDependency[] {
  const parsed: ParsedZephyrDependency[] = [];

  for (const [name, value] of Object.entries(dependencies)) {
    const dep = parseZephyrDependency(name, value);
    if (dep) {
      parsed.push(dep);
    }
  }

  return parsed;
}

/**
 * Validate that a string is a valid zephyr protocol string
 *
 * @param value - The string to validate
 * @returns true if valid zephyr protocol format
 */
export function isValidZephyrProtocol(value: string): boolean {
  return parseZephyrProtocol(value) !== null;
}
