import { ConfigurationError } from './configuration-error';

export class PackageNotAJsonError extends ConfigurationError {
  constructor(path: string | undefined) {
    super(`ZE_ERROR_10020: package.json '${path}' is not valid json.`);
  }
}
