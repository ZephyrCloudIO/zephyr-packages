import {
  zephyr_snapshot_filename,
  type ZephyrRuntimeSnapshotOptions,
} from '../ze-api/app-runtime';
import { simpleJoinFilePath } from './simple-join-file-path';

export function getSnapshotFileName(snapshotOptions?: ZephyrRuntimeSnapshotOptions): {
  snapshotFileName: string;
} {
  if (!snapshotOptions) {
    return {
      snapshotFileName: zephyr_snapshot_filename,
    };
  }

  const filePath =
    typeof snapshotOptions === 'boolean' ? '' : snapshotOptions.filePath || '';
  const fileName =
    typeof snapshotOptions === 'boolean' ? '' : snapshotOptions.fileName || '';

  const JSON_EXT = '.json';
  const addExt = (name: string): string => {
    if (name.endsWith(JSON_EXT)) {
      return name;
    }
    return `${name}${JSON_EXT}`;
  };

  const snapshotFileName = fileName ? addExt(fileName) : zephyr_snapshot_filename;

  return {
    snapshotFileName: simpleJoinFilePath(filePath, snapshotFileName),
  };
}
