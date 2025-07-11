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

export const ze_error = debug('zephyr:error');
export const ze_debug = debug('zephyr:debug');
const createLogger = () => {
  return {
    app: debug('zephyr:app'),
    auth: debug('zephyr:auth'),
    config: debug('zephyr:config'),
    git: debug('zephyr:git'),
    http: debug('zephyr:http'),
    init: debug('zephyr:init'),
    mf: debug('zephyr:mf'),
    misc: debug('zephyr:misc'),
    package: debug('zephyr:package'),
    remotes: debug('zephyr:remotes'),
    snapshot: debug('zephyr:snapshot'),
    upload: debug('zephyr:upload'),
  };
};

/**
 * Debug contexts:
 *
 * - Ze_log.app: Application config information
 * - Ze_log.auth: Authentication and token management
 * - Ze_log.config: Authentication and token management
 * - Ze_log.git: Git configuration and provider
 * - Ze_log.http: http requests
 * - Ze_log.init: Initialization and setup operations
 * - Ze_log.mf: Module Federation config
 * - Ze_log.misc: Miscellaneous
 * - Ze_log.package: Package.json parsing
 * - Ze_log.remotes: Remote dependency resolution
 * - Ze_log.snapshot: Snapshot publish
 * - Ze_log.upload: Asset and build stats upload
 */
export const ze_log = createLogger();
// If debug mode is not enabled just print whatever console output is
// If debug mode is enabled print the error from our end
