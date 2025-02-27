import { ConfigurationError } from './configuration-error';

export class PackageJsonNotFoundError extends ConfigurationError {
  constructor(context: string | undefined) {
    super(`ZE10010`, `package.json not found from '${context}'`);
  }
}
