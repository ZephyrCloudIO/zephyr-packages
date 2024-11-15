import fs from 'node:fs';
import { resolve } from 'node:path';
import { safe_json_parse } from 'zephyr-edge-contract';

import { find_nearest_package_json } from './find-nearest-package-json';
import { ZePackageJson } from './ze-package-json.type';
import { getPackageJsonCache, setPackageJsonCache } from './fs-cache-for-package-json';
import { ze_log } from '../logging';
import { PackageJsonNotFoundError } from '../errors/package-json-not-found-error';
import { PackageNotAJsonError } from '../errors/package-not-a-json-error';
import { PackageJsonNotValidError } from '../errors/package-json-not-valid-error';

export async function getPackageJson(
  context: string | undefined
): Promise<ZePackageJson> {
  let startingPath = context || process.cwd();

  if (fs.statSync(startingPath).isFile()) {
    startingPath = resolve(startingPath, '..');
  }

  const cached = await getPackageJsonCache(startingPath);
  if (cached) return cached;

  const nearest_package_json = await find_nearest_package_json(startingPath);

  if (!nearest_package_json) {
    throw new PackageJsonNotFoundError(context);
  }

  const { json, path } = nearest_package_json;
  const parsed_package_json = safe_json_parse<ZePackageJson>(json);
  if (!parsed_package_json) {
    throw new PackageNotAJsonError(path);
  }

  if (!parsed_package_json.name || !parsed_package_json.version) {
    throw new PackageJsonNotValidError(path);
  }

  ze_log('package json found', parsed_package_json);
  await setPackageJsonCache(startingPath, parsed_package_json);

  return parsed_package_json;
}
