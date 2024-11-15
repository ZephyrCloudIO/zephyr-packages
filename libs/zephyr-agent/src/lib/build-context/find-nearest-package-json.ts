import { readFile } from 'node:fs/promises';
import { accessSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { constants } from 'fs/promises';
import { PackageJsonNotFoundError } from '../errors/package-json-not-found-error';

const max_retry = 30;

export async function find_nearest_package_json(startPath: string): Promise<{
  path: string;
  json: string;
}> {
  if (!startPath) {
    throw new PackageJsonNotFoundError(`${startPath}`);
  }

  let retry = 0;
  let dir = startPath;
  do {
    retry++;
    if (retry > max_retry) {
      throw new PackageJsonNotFoundError(`${startPath} after ${max_retry} retries`);
    }

    const packageJsonPath = join(dir, 'package.json');
    try {
      accessSync(packageJsonPath, constants.F_OK);
      return {
        path: packageJsonPath,
        json: await readFile(packageJsonPath, 'utf8'),
      };
    } catch (e) {
      // do nothing
    }

    const parentDir = resolve(dir, '..');
    if (parentDir === dir) {
      throw new PackageJsonNotFoundError(`${startPath}`);
    }
    dir = parentDir;
  } while (startPath !== dir);

  throw new PackageJsonNotFoundError(`${startPath}`);
}
