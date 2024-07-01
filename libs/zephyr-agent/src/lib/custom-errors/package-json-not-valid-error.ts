import { ConfigurationError } from './configuration-error';

export class PackageJsonNotValidError extends ConfigurationError {
  constructor(path: string | undefined) {
    super(`BU10013`, `package json ('${path}') \n
    must have a 'name' and a 'version' properties`);
  }
}
