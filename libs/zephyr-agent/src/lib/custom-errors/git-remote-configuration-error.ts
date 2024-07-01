import { ConfigurationError } from './configuration-error';

export class GitRemoteConfigurationError extends ConfigurationError {
  constructor() {
    super(`BU10014`, `git remote origin is not configured properly \n
        - please set valid 'git remote origin' by using commands below\n
        - git init && git remote add origin <url> \n`);
  }
}
