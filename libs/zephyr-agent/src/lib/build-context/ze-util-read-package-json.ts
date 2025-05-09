import fs from 'node:fs';
import { resolve } from 'node:path';
import { safe_json_parse } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';
import { find_nearest_package_json } from './find-nearest-package-json';
import { getPackageJsonCache, setPackageJsonCache } from './fs-cache-for-package-json';
import type { ZePackageJson } from './ze-package-json.type';

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
    throw new ZephyrError(ZeErrors.ERR_PACKAGE_JSON_NOT_FOUND);
  }

  const { json } = nearest_package_json;
  const parsed_package_json = safe_json_parse<ZePackageJson>(json);
  if (!parsed_package_json) {
    throw new ZephyrError(ZeErrors.ERR_PACKAGE_JSON_NOT_VALID);
  }

  if (!parsed_package_json.name || !parsed_package_json.version) {
    throw new ZephyrError(ZeErrors.ERR_PACKAGE_JSON_MUST_HAVE_NAME_VERSION);
  }

  ze_log('package json found', parsed_package_json);
  await setPackageJsonCache(startingPath, parsed_package_json);

  return parsed_package_json;
}
