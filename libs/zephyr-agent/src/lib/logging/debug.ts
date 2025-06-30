// light weight functions for decorated console.error + able to toggle different parts of whole module's logging result
import { debug } from 'debug';
import {
  bgCyanBright,
  bgGreenBright,
  bgRedBright,
  bgYellowBright,
  black,
  bold,
  dim,
} from './picocolor';

//TODO: this should be traced and logged into new relic
const name = ' ZEPHYR ';

export const dimmedName = dim(name);

export const brightBlueBgName = bold(bgCyanBright(black(name)));

export const brightYellowBgName = bold(bgYellowBright(black(name)));

export const brightGreenBgName = bold(bgGreenBright(black(name)));

export const brightRedBgName = bold(bgRedBright(black(name)));

export const ze_log = debug('zephyr:log');
export const ze_error = debug('zephyr:error');
export const ze_debug = debug('zephyr:debug');
// If debug mode is not enabled just print whatever console output is
// If debug mode is enabled print the error from our end
