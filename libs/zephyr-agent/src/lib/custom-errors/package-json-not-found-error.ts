import { ConfigurationError } from './configuration-error';

export class PackageJsonNotFoundError extends ConfigurationError {
  constructor(context: string | undefined) {
    super(`ZE_ERROR_10010: package.json not found from '${context}'`);
  }
}
