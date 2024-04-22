import { debug } from 'debug';
import * as process from 'node:process';

const name = 'zephyr';

export const is_debug_enabled = (process.env['DEBUG'] ?? '')
  .indexOf('zephyr:*') !== -1 ?? false;

export const ze_log = debug(`${name}:log`);
export const ze_error = is_debug_enabled
  ? debug(`${name}:error`)
  : console.error.bind(console);
