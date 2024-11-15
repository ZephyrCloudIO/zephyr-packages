import { ConfigurationError } from './configuration-error';

export class PackageNotAJsonError extends ConfigurationError {
  constructor(path: string | undefined) {
    super(`ZE10011`, `package.json '${path}' is in valid json format.`);
  }
}
