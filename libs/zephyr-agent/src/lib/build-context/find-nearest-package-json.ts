import { accessSync } from 'node:fs';
import { constants, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging/debug';

const max_retry = 30;

export async function find_nearest_package_json(startPath: string): Promise<{
  path: string;
  json: string;
}> {
  if (!startPath) {
    throw new ZephyrError(ZeErrors.ERR_PACKAGE_JSON_NOT_FOUND);
  }

  let retry = 0;
  let dir = startPath;
  do {
    retry++;
    if (retry > max_retry) {
      throw new ZephyrError(ZeErrors.ERR_PACKAGE_JSON_NOT_FOUND);
    }

    const packageJsonPath = join(dir, 'package.json');
    try {
      accessSync(packageJsonPath, constants.F_OK);
      return {
        path: packageJsonPath,
        json: await readFile(packageJsonPath, 'utf8'),
      };
    } catch (e) {
      ze_log(e);
    }

    const parentDir = resolve(dir, '..');
    if (parentDir === dir) {
      throw new ZephyrError(ZeErrors.ERR_PACKAGE_JSON_NOT_FOUND);
    }
    dir = parentDir;
  } while (startPath !== dir);

  throw new ZephyrError(ZeErrors.ERR_PACKAGE_JSON_NOT_FOUND);
}
