// light weight utils for decorated console.error + able to toggle different parts of whole module's logging result
import { debug } from 'debug';
import { dim, bold, bgCyanBright, black, bgYellowBright, bgRedBright, redBright } from './picocolor';
import { is_debug_enabled } from './debug-enabled';
import { err } from './error-formatted-message';
import { Errors } from './error-codes-messages';

//TODO: this should be traced and logged into new relic
//TODO: print different colors to it + Capitalize maybe?
const name = ' ZEPHYR ';

export const dimmedName = dim(name);

export const brightBlueBgName = bold(bgCyanBright(black(name)));

export const brightYellowBgName = bold(bgYellowBright(black(name)));

export const brightRedBgName = bold(bgRedBright(black(name)));

function print_error_with_docs<K extends keyof typeof Errors>(errMsg?: K, ...args: unknown[]) {
  errMsg ? console.log(`${brightRedBgName} ${err(errMsg)} ${args} \n`) : console.log(brightRedBgName, redBright('Unknown error'), args);
}

export const ze_log = debug('zephyr:log');
// If debug mode is not enabled just print whatever console output is
// If debug mode is enabled print the error from our end
/** `ze_error` is used widely to debug our local build and deployment. You can turn on debug mode or having it work normally to attached documentation with our error codes in [errors](./error-types.ts). We have added unknown class to the error object.
 * If this is an error we haven't defined yet, you will need to do
 * @example
 * ```ts
 * ze_error('ERR_UNKNOWN', `Error creating dist folder: ${(error as Error).message}`);
 * ```
 * to specify this is an undefined error at the front.
 */
export const ze_error = is_debug_enabled ? debug('zephyr:error') : (print_error_with_docs as typeof print_error_with_docs);
