import fs from 'node:fs';
import { resolve } from 'node:path';
import { safe_json_parse } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';
import { find_nearest_package_json } from './find-nearest-package-json';
import type { ZePackageJson } from './ze-package-json.type';
import { parseZeDependencies } from './ze-util-parse-ze-dependencies';
/**
 * Retrieves and parses the package.json file from the given context path or current
 * working directory. The function will search for the nearest package.json file in the
 * directory tree, validate its contents, and cache the result to improve performance.
 *
 * @param context - The starting path to search for package.json. If undefined, uses
 *   current working directory.
 * @returns {Promise<ZePackageJson>} A Promise that resolves to the parsed package.json
 *   content.
 * @throws {ZephyrError} If the package.json cannot be found, parsed, or has missing
 *   required fields.
 */
export async function getPackageJson(
  context: string | undefined
): Promise<ZePackageJson> {
  // Determine the starting path
  let startingPath: string;
  try {
    startingPath = context || process.cwd();

    // If the path is a file, move up one directory level
    if (startingPath && fs.statSync(startingPath).isFile()) {
      startingPath = resolve(startingPath, '..');
    }

    ze_log.init('getPackageJson searching from path', startingPath);
  } catch (error) {
    throw new ZephyrError(
      ZeErrors.ERR_PACKAGE_JSON_NOT_FOUND,
      `Invalid starting path: ${context}. Error: ${error}`
    );
  }

  // Find nearest package.json
  let nearest_package_json;
  try {
    nearest_package_json = await find_nearest_package_json(startingPath);

    if (!nearest_package_json) {
      throw new ZephyrError(
        ZeErrors.ERR_PACKAGE_JSON_NOT_FOUND,
        `No package.json found starting from: ${startingPath}`
      );
    }

    ze_log.init('Found package.json at', nearest_package_json.path);
  } catch (error) {
    if (error instanceof ZephyrError) {
      throw error; // Re-throw existing ZephyrError
    }
    throw new ZephyrError(
      ZeErrors.ERR_PACKAGE_JSON_NOT_FOUND,
      `Error finding package.json from path: ${startingPath}. Error: ${error}`
    );
  }

  // Parse and validate package.json
  try {
    const { json, path: packageJsonPath } = nearest_package_json;
    const parsed_package_json = safe_json_parse<ZePackageJson>(json);

    if (!parsed_package_json) {
      throw new ZephyrError(
        ZeErrors.ERR_PACKAGE_JSON_NOT_VALID,
        `Invalid JSON in package.json at: ${packageJsonPath}`
      );
    }

    // Validate required fields
    if (!parsed_package_json.name) {
      throw new ZephyrError(
        ZeErrors.ERR_PACKAGE_JSON_MUST_HAVE_NAME_VERSION,
        `Missing 'name' field in package.json at: ${packageJsonPath}`
      );
    }

    if (!parsed_package_json.version) {
      throw new ZephyrError(
        ZeErrors.ERR_PACKAGE_JSON_MUST_HAVE_NAME_VERSION,
        `Missing 'version' field in package.json at: ${packageJsonPath}`
      );
    }

    const zephyr_dependencies = parsed_package_json['zephyr:dependencies'];
    if (zephyr_dependencies) {
      parsed_package_json.zephyrDependencies = parseZeDependencies(zephyr_dependencies);
    }

    ze_log.init('Successfully parsed package.json', {
      name: parsed_package_json.name,
      version: parsed_package_json.version,
      path: packageJsonPath,
    });

    return parsed_package_json;
  } catch (error) {
    if (error instanceof ZephyrError) {
      throw error; // Re-throw existing ZephyrError
    }
    throw new ZephyrError(
      ZeErrors.ERR_PACKAGE_JSON_NOT_VALID,
      `Error processing package.json: ${error}`
    );
  }
}
