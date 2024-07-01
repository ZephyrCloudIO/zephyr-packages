import { debug } from 'debug';
import * as process from 'node:process';
import { bold, bgBlue, dim, black, blue, bgBlueBright, bgCyanBright, bgYellowBright, yellow, red } from './picocolor';
import { BuildErrorCode, DeployErrorCode, ErrorCategories, RuntimeErrorCode, errorMessages } from './error-types';



const name = ' ZEPHYR ';

const doc = 'For potential workaround, see documentation https://docs.zephyr-cloud.io/guide/error'

export const dimmedName = dim(name)

export const brightBlueBgName = bold(bgCyanBright(black(name)))

export const brightYellowBgName = bold(bgYellowBright(black(name)))

export const brightRedBgName = bold(bgYellowBright(black(name)))

/** @description Custom error code sync with documentation on https://docs.zephyr-cloud.io */
type CodeType = BuildErrorCode | DeployErrorCode | RuntimeErrorCode
class ZE_DEBUG {

  constructor() {
    this.error = this.error.bind(this);
  }

  errorCodeFormatter(code: string) {
    return red(`Error code: [${code}]`)
  }

  success(msg: string) {
    const blueMessage = blue(msg)

    debug(`\n${brightBlueBgName} ${blueMessage}\n`)
  }

  log(msg: string) {
    const yellowMessage = yellow(msg)

    debug(`\n${brightYellowBgName}:log ${yellowMessage} \n`)
  }

  /** first parameter being error code, if this error is unknown and not defined, pass in "" as empty string as first parameter and it will auto return "Unknown error".
   * The code and error types located in [error-types.ts](./error-types.ts)
   * @description If error code is passed in it will return pretty and formatted error.
   * @example **Passing empty error code**
   * ```
   * ze_error("",
        `[${options?.method || 'GET'}][${url}]: ${Date.now() - req_start}ms \n ${_options_str} \n Error: ${e}`
      );
      ```
   */
  error(code?: CodeType | unknown, msg?: string | boolean | void, ...arg: unknown[]) {
    const redMessage = typeof msg === "string" ? red(msg) : "Unknown error" + msg

    const errorCode = this.errorCodeFormatter(code as string)

    let details = redMessage
    if (typeof code === "string" && code?.startsWith("BU")) {
      details = red(errorMessages.buildErrorMessages[code as BuildErrorCode])
    }

    if (typeof code === "string" && code?.startsWith("DE")) {
      details = red(errorMessages.deployErrorMessages[code as DeployErrorCode])
    }

    if (typeof code === "string" && code?.startsWith("RT")) {
      details = red(errorMessages.runtimeErrorMessages[code as RuntimeErrorCode])
    }

    const documentation = code ? red(`\n${doc}/${code.toString().toLowerCase()}`) : red(`\n${doc}`)

    console.error.bind(`\n${brightRedBgName} ${errorCode} ${details ?? redMessage} \n`, console, ...arg, documentation)
  }
}

const _zephyr_debug = process.env['DEBUG']?.indexOf('zephyr');
export const is_debug_enabled = typeof _zephyr_debug === 'number'
  && _zephyr_debug !== -1;

export const ze_log = debug(`${brightBlueBgName}:log`);


export const ze_error = is_debug_enabled
  ? debug(`${brightRedBgName}:error`)
  : new ZE_DEBUG().error


export const console = new ZE_DEBUG()
