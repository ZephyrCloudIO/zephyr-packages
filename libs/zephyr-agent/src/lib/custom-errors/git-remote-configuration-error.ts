import { ConfigurationError } from './configuration-error';

export class GitRemoteConfigurationError extends ConfigurationError {
  constructor() {
    super(`ZE_ERROR_10110: git remote origin is not configured properly \n
        - please set valid 'git remote origin'\n
        - or use git init amd git remote add origin <url> \n`);
  }
}
