import { ze_error, ze_log, ZeBuildAssetsMap } from 'zephyr-edge-contract';
import { access, constants, mkdir, writeFile } from 'fs/promises';
import { dirname, sep } from 'path';

export async function saveAssetsToFilesIfNotExist(dir: string, assetsMap: ZeBuildAssetsMap): Promise<string> {
  try {
    await access(dir, constants.R_OK | constants.W_OK);
  } catch (error) {
    ze_log(`Dist folder doesn't exist, creating`);
    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      ze_error('ERR_CREATE_DIST_FOLDER', `Error creating dist folder: ${(error as Error).message}`);
      throw new Error('Unable to create dist folder.');
    }
  }

  const promises: Promise<void>[] = [];
  for (const [, { path, buffer }] of Object.entries(assetsMap)) {
    const fullPath = `${dir}${sep}${path}`;
    if (path.includes('/')) {
      promises.push(mkdir(dirname(fullPath), { recursive: true }).then(() => writeFile(`${dir}/${path}`, buffer, { flag: 'w+' })));
    } else {
      promises.push(writeFile(`${dir}/${path}`, buffer, { flag: 'w+' }));
    }
  }

  return Promise.all(promises).then(() => dir);
}
