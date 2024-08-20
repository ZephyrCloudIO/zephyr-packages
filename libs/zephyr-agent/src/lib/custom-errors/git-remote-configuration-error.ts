import { ConfigurationError } from './configuration-error';

const gitRemoteErrMsg = `git remote origin is not configured properly
- please set valid 'git remote origin' by using commands below
- git init && git remote add origin <url>`.trim();

export class GitRemoteConfigurationError extends ConfigurationError {
  constructor() {
    super(`ZE10014`, gitRemoteErrMsg);
  }
}
