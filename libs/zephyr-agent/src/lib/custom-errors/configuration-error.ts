export class ConfigurationError extends Error {
  constructor(message: string) {
    super(`[zephyr]: ${message}`);
    this.name = 'ConfigurationError';
    // looks weird right? but vite build logger prints only stack trace,
    // so this is how we ended up with this.
    (this as {_stack?: string})._stack = this.stack;
    this.stack = this.message;
  }
}
