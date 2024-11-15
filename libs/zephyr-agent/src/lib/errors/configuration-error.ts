import { brightRedBgName } from '../logging/debug';

export class ConfigurationError extends Error {
  //  link to wherever documentation is
  // docs usually locate at this address
  constructor(code: string, message: string, level?: 'normal' | 'critical') {
    super(
      `${brightRedBgName} ${level === 'critical' ? `Critical error` : `Error`} [${code}]: ${message} \n ${code ? `See documentation on how to debug this error: https://docs.zephyr-cloud.io/errors/${code.toLowerCase()}` : ''}`
    );
    this.name = 'ConfigurationError';
    // looks weird right? but vite build logger prints only stack trace,
    // so this is how we ended up with this.
    (this as { _stack?: string })._stack = this.stack;
    this.stack = this.message;
  }
}
