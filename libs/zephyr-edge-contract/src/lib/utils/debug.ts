import { debug } from 'debug';
import * as process from 'node:process';

const name = 'zephyr';
const _zephyr_debug = process.env['DEBUG']?.indexOf('zephyr');
export const is_debug_enabled = typeof _zephyr_debug === 'number'
  && _zephyr_debug !== -1;

export const ze_log = debug(`${name}:log`);
export const ze_error = is_debug_enabled
  ? debug(`${name}:error`)
  : console.error.bind(console);
