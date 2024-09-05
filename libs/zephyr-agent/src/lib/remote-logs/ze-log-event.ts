import type { ZephyrPluginOptions } from 'zephyr-edge-contract';
import {
  ZE_API_ENDPOINT,
  brightBlueBgName,
  brightGreenBgName,
  brightRedBgName,
  brightYellowBgName,
  getToken,
  is_debug_enabled,
  request,
  ze_api_gateway,
  ze_log,
} from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../application-configuration/get-application-configuration';
import { PromiseLazyLoad } from '../util/promise';
import { stripAnsi } from '../util/strip-ansi';

export const logFn = (level: string, msg: unknown): void => {
  if (is_debug_enabled) {
    ze_log(msg);
    return;
  }

  const str = String(msg);
  const padded = str
    .split('\n')
    .map((m) => `${toLevelPrefix(level)}  ${m.trim()}`)
    .join('\n');

  switch (level) {
    case 'warn':
      console.warn(padded);
      break;
    case 'debug':
      console.debug(padded);
      break;
    case 'error':
      console.error(padded);
      break;
    default:
      console.log(padded);
  }
};

function toLevelPrefix(level: string) {
  switch (level) {
    case 'warn':
      return brightYellowBgName;
    case 'debug':
      return brightGreenBgName;
    case 'error':
      return brightRedBgName;
    default:
      return brightBlueBgName;
  }
}

export interface LogEventOptions {
  level: string;
  action: string;
  message: string;
  ignore?: boolean;
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
            logs
              // some logs are empty to give newline effect in terminal
              .filter((l) => l.message.length && !l.ignore)
              .map((log) => ({
                application_uid: options.application_uid,
                userId: config.user_uuid,
                username: config.username,
                zeBuildId: options.zeConfig.buildId,
                logLevel: log.level,
                actionType: log.action,
                git: options.git,
                message: stripAnsi(log.message.trim()),
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
