import { existsSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

export const findPackageJson = (filePath: string[] | undefined): undefined | unknown => {
  if (!filePath || filePath.length === 0) {
    return;
  }
  if (existsSync(join(filePath.join(sep), 'package.json'))) {
    try {
      const file = readFileSync(join(filePath.join(sep), 'package.json'), 'utf-8');
      return JSON.parse(file);
    } catch (e) {
      console.error(e);
    }
  }
  filePath.pop();
  return findPackageJson(filePath);
};
