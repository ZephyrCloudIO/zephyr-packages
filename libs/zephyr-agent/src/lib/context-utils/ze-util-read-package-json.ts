import * as fs from 'node:fs';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { _fs_cache, safe_json_parse, ze_log } from 'zephyr-edge-contract';

import { ConfigurationError } from '../custom-errors/configuration-error';
import { PackageJsonNotFoundError } from '../custom-errors/package-json-not-found-error';
import { PackageNotAJsonError } from '../custom-errors/package-not-a-json-error';
import { PackageJsonNotValidError } from '../custom-errors/package-json-not-valid-error';

const exists = promisify(fs.exists);
const readFile = promisify(fs.readFile);
const cache_prefix = 'package_json';

interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
}

export async function getPackageJson(
  context: string | undefined,
): Promise<PackageJson> {
  let startingPath = context || process.cwd();
  if (fs.statSync(startingPath).isFile()) {
    startingPath = resolve(startingPath, '..');
  }

  const cache_key = `${cache_prefix}:${startingPath}`;
  const cached = await _fs_cache.getCache(cache_key);
  if (cached) return JSON.parse(cached);

  const res = await findClosestPackageJson(startingPath);

  if (!res) {
    throw new PackageJsonNotFoundError(context);
  }

  const { json, path } = res;
  const parsed_package_json = safe_json_parse<PackageJson>(json);
  if (!parsed_package_json) {
    throw new PackageNotAJsonError(path);
  }

  if (!parsed_package_json.name || !parsed_package_json.version) {
    throw new PackageJsonNotValidError(path);
  }

  ze_log('package json found', parsed_package_json);
  await _fs_cache.saveCache(cache_key, JSON.stringify(parsed_package_json));
  return parsed_package_json;
}

async function findClosestPackageJson(
  startPath: string,
): Promise<{ path: string; json: string } | void> {
  let dir = startPath;
  do {
    const packageJsonPath = join(dir, 'package.json');
    if (await exists(packageJsonPath)) {
      return {
        path: packageJsonPath,
        json: await readFile(packageJsonPath, 'utf8'),
      };
    }

    const parentDir = resolve(dir, '..');
    if (parentDir === dir) {
      throw new PackageJsonNotFoundError(`${startPath}`);
    }
    dir = parentDir;
  } while (startPath !== dir);
}
