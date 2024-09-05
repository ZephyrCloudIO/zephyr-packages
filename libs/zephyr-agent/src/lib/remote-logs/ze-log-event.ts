import type { ZephyrPluginOptions } from 'zephyr-edge-contract';
import {
  ZE_API_ENDPOINT,
  type ZeApplicationConfig,
  brightBlueBgName,
  brightRedBgName,
  brightYellowBgName,
  getToken,
  is_debug_enabled,
  request,
  brightGreenBgName,
  ze_api_gateway,
  ze_log,
} from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../application-configuration/get-application-configuration';
import { stripAnsi } from '../util/strip-ansi';
import { PromiseLazyLoad } from '../util/promise';

export const logFn = (level: string, msg: unknown): void => {
  if (is_debug_enabled) {
    ze_log(msg);
    return;
  }

  switch (level) {
    case 'warn':
      console.warn(`${brightYellowBgName}  ${msg}`);
      break;
    case 'debug':
      console.debug(`${brightGreenBgName}  ${msg}`);
      break;
    case 'error':
      console.error(`${brightRedBgName}  ${msg}`);
      break;
    default:
      console.log(`${brightBlueBgName}  ${msg}`);
  }
};

export interface LogEventOptions {
  level: string;
  action: string;
  message: string;
  meta?: Record<string, unknown>;
}

export type LogEvent = (options: LogEventOptions) => void;

export type ZeLogger = (...logs: LogEventOptions[]) => void;

export function logger(options: ZephyrPluginOptions): ZeLogger {
  // lazy loads the application configuration and token
  const loadLogData = PromiseLazyLoad(() => {
    return Promise.all([getApplicationConfiguration({ application_uid: options.application_uid }), getToken()]);
  });

  const url = new URL(ze_api_gateway.logs, ZE_API_ENDPOINT());

  return function logEvent(...logs): void {
    // Prints logs to the console as fast as possible
    for (const log of logs) {
      if (!log.level && !log.action) {
        throw new Error('log level and action type must be provided');
      }

      // trims every message
      log.message = log.message.trim();

      logFn(log.level, log.message);
    }

    // Then attempt to upload logs,
    loadLogData()
      .then(([config, token]) =>
        request(
          url,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
          JSON.stringify(
            logs.map((log) => ({
              application_uid: options.application_uid,
              userId: config.user_uuid,
              username: config.username,
              zeBuildId: options.zeConfig.buildId,
              logLevel: log.level,
              actionType: log.action,
              git: options.git,
              message: stripAnsi(log.message),
              meta: Object.assign({}, log.meta, { isCI: options.isCI, app: options.app, git: options.git }),
              createdAt: Date.now(),
            }))
          )
        )
      )
      // This is ok to fail silently
      .catch(() => void 0);
  };
}
