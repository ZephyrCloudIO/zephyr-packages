// light weight utils for decorated console.error + able to toggle different parts of whole module's logging result
import { debug } from 'debug';
import {
  dim,
  bold,
  bgCyanBright,
  black,
  bgYellowBright,
  bgRedBright,
} from './picocolor';
import { is_debug_enabled } from './debug-enabled';

//TODO: this should be traced and logged into new relic
//TODO: print different colors to it + Capitalize maybe?
const name = ' ZEPHYR ';

export const dimmedName = dim(name);

export const brightBlueBgName = bold(bgCyanBright(black(name)));

export const brightYellowBgName = bold(bgYellowBright(black(name)));

export const brightRedBgName = bold(bgRedBright(black(name)));

export const ze_log = debug("zephyr:log");
// If debug mode is not enabled just print whatever console output is
// If debug mode is enabled print the error from our end
export const ze_error = is_debug_enabled
  ? debug("zephyr:error")
  : console.error.bind(console);
