import { Snapshot } from '../snapshot';

export const zephyr_snapshot_filename = 'zephyr-snapshot.json';

export interface ZephyrRuntimeSnapshotOptions {
  snapshot: Snapshot;
  zephyr_environment?: string;
  filePath?: string;
  fileName?: string;
}
