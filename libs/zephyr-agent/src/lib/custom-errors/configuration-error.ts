export class ConfigurationError extends Error {
  constructor(message: string) {
    super(`[zephyr]: ${message}`);
    this.name = 'ConfigurationError';
    this.stack = void 0;
  }
}
