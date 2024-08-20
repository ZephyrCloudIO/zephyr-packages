import { ConfigurationError } from './configuration-error';

const noBuildIdErrMsg = `Could not get build id. Please make sure you have:
- a Zephyr account registered on https://app.zephyr-cloud.io
- git remote origin url is configured
- this repository has commit history`.trim();

export class CouldNotGetBuildIdError extends ConfigurationError {
  constructor() {
    super(`ZE10019`, noBuildIdErrMsg);
  }
}
