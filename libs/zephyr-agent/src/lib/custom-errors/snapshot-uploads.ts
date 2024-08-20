import { ConfigurationError } from './configuration-error';

const snapshotUploadFailed = `Failed to upload snapshot.`.trim();

export class SnapshotUploadFailureError extends ConfigurationError {
  constructor() {
    super(`ZE20018`, snapshotUploadFailed);
  }
}

const snapshotUploadNoResult = `Snapshot upload gave no result, exiting...`;

export class SnapshotUploadNoResultError extends ConfigurationError {
  constructor() {
    super(`ZE20019`, snapshotUploadNoResult);
  }
}
