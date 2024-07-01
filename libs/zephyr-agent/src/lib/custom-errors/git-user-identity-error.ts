import { ConfigurationError } from './configuration-error';

export class GitUserIdentityError extends ConfigurationError {
  constructor() {
    super(`BU10015`, `git username or email is not configured \n
        - please set valid 'git config user.name' and 'git config user.email' \n
        - or provide ZE_USER_TOKEN as environment variable \n`);
  }
}
