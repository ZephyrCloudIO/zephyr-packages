/**
 * Parses Zephyr dependency entries from package.json and transforms them into structured
 * format. Dependencies can be specified in various formats:
 *
 * - Standard semver: "^1.0.0"
 * - Zephyr remote with tag: "zephyr:remote_app_uid@latest"
 * - Zephyr with semver: "zephyr:^1.0.0"
 * - Wildcard version: "*" (resolves to latest available version)
 *
 * @param ze_dependencies - Object with dependency name as key and version/reference as
 *   value
 * @returns Parsed zephyr dependencies with structured information
 */
import type { ZeDependency } from './ze-package-json.type';

export function parseZeDependencies(
  ze_dependencies: Record<string, string>
): Record<string, ZeDependency> {
  return Object.fromEntries(
    Object.entries(ze_dependencies).map(([key, value]) => [
      key,
      parseZeDependency(key, value),
    ])
  );
}

/**
 * Parses a single dependency value into a structured ZeDependency object.
 *
 * @param key - The dependency name
 * @param value - The dependency version or reference string
 * @returns Structured dependency information
 */
export function parseZeDependency(key: string, value: string): ZeDependency {
  // Default dependency structure
  const dependency: ZeDependency = {
    version: value,
    registry: 'zephyr',
    app_uid: key,
  };

  let reference = value;

  // if reference variable has ':' then cut it off and store dependency.registry
  if (reference.includes(':') && !reference.includes('workspace:*')) {
    const reference_parts = reference.split(':');
    dependency.registry = reference_parts[0];
    reference = reference_parts[1];
  }

  // Check if it contains a remote app_uid with a tag (e.g., "remote_app_uid@latest")
  if (reference.includes('@')) {
    const reference_parts = reference.split('@');
    // consider scoped application names
    // e.g.: @app-zephyr/host@latest
    dependency.app_uid = reference_parts.slice(0, reference_parts.length - 1).join('@');
    dependency.version = reference_parts[reference_parts.length - 1];
  }
  // If it's a semver specification (contains ^, ~, >, <, or =)
  else {
    dependency.version = reference;
  }

  return dependency;
}
