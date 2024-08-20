import { ConfigurationError } from './configuration-error';

export class PackageJsonNotValidError extends ConfigurationError {
  constructor(path: string | undefined) {
    super(`ZE10013`, `package json in ('${path}') must have a 'name' and a 'version' properties`);
  }
}
