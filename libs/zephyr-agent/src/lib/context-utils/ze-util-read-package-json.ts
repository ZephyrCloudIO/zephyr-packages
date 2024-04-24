import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ConfigurationError } from '../custom-errors/configuration-error';
import { safe_json_parse } from '../sync-utils/safe-json-parse';

interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
}

export function getPackageJson(
  context: string | undefined
): PackageJson | undefined {
  const res = findClosestPackageJson(context || process.cwd());
  if (!res) {
    throw new ConfigurationError(
      `package.json not found with context: '${context}'`
    );
  }

  const { json, path } = res;
  const parsed_package_json = safe_json_parse<PackageJson>(json);
  if (!parsed_package_json) {
    throw new ConfigurationError(`package.json ${path} \n is not valid json`);
  }

  if (!parsed_package_json.name || !parsed_package_json.version) {
    throw new ConfigurationError(`package json ('${path}') \n
    should have a 'name' and a 'version' properties`);
  }

  return parsed_package_json;
}

function findClosestPackageJson(
  startPath: string
): { path: string; json: string } | void {
  let dir = startPath;
  do {
    const packageJsonPath = join(dir, 'package.json');
    if (existsSync(packageJsonPath)) {
      return {
        path: packageJsonPath,
        json: readFileSync(packageJsonPath, 'utf8'),
      };
    }

    const parentDir = resolve(dir, '..');
    if (parentDir === dir) {
      throw new ConfigurationError(`No package.json found, in ${startPath}`);
    }
    dir = parentDir;
  } while (startPath !== dir);
}
