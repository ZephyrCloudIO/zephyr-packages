import { debug, enabled } from 'debug';

const name = 'zephyr';

export const ze_log = debug(`${name}:log`);
export const ze_error = enabled('zephyr:*') ? debug(`${name}:error`) : console.error.bind(console);
