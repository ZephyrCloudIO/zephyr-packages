import { ConfigurationError } from './configuration-error';

const gitUserErrMsg = `git username or email is not configured
- please set valid 'git config user.name' and 'git config user.email'
- or provide ZE_USER_TOKEN as environment variable`.trim();

export class GitUserIdentityError extends ConfigurationError {
  constructor() {
    super(`ZE10015`, gitUserErrMsg);
  }
}
