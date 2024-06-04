import { ConfigurationError } from './configuration-error';

export class PackageJsonNotValidError extends ConfigurationError {
  constructor(path: string | undefined) {
    super(`ZE_ERROR_10030: package json ('${path}') \n
    must have a 'name' and a 'version' properties`);
  }
}
