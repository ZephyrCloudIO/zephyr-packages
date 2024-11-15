import * as process from 'node:process';

const _zephyr_debug = process.env['DEBUG']?.indexOf('zephyr');

export const is_debug_enabled = typeof _zephyr_debug === 'number' && _zephyr_debug !== -1;
