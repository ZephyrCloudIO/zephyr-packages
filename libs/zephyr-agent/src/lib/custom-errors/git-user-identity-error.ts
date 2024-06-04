import { ConfigurationError } from './configuration-error';

export class GitUserIdentityError extends ConfigurationError {
  constructor() {
    super(`ZE_ERROR_10120: git user name or email is not configured properly \n
        - please set valid 'git config user.name' and 'git config user.email' \n
        - or provide ZE_USER_TOKEN as environment variable \n`);
  }
}
