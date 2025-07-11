import {
  PromiseLazyLoad,
  ZE_API_ENDPOINT,
  stripAnsi,
  ze_api_gateway,
} from 'zephyr-edge-contract';
import type { ZeGitInfo } from '../build-context/ze-util-get-git-info';
import { getApplicationConfiguration } from '../edge-requests/get-application-configuration';
import { ZeErrors, ZephyrError } from '../errors';
import { makeRequest } from '../http/http-request';
import { getToken } from '../node-persist/token';
import {
  brightBlueBgName,
  brightGreenBgName,
  brightRedBgName,
  brightYellowBgName,
} from './debug';

export const logFn = (level: string, msg: unknown): void => {
  const formatted = formatLogMsg(msg, level);

  switch (level) {
    case 'warn':
      console.warn(formatted);
      break;
    case 'debug':
      console.debug(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
    default:
      console.log(formatted);
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

export function formatLogMsg(msg: unknown, level = 'info') {
  return String(msg)
    .split('\n')
    .map((m) => `${toLevelPrefix(level)}  ${m.trimEnd()}`)
    .join('\n');
}

export interface LogEventOptions {
  level: string;
  action: string;
  message: string;
  table?: { key: string; value: (string | undefined)[] }[];
  ignore?: boolean;
}

export type LogEvent = (options: LogEventOptions) => void;

export type ZeLogger = (...logs: LogEventOptions[]) => void;

interface LoggerOptions {
  application_uid: string;
  buildId?: string;
  git: ZeGitInfo['git'];
}

export function logger(props: LoggerOptions): ZeLogger {
  const { application_uid, buildId, git } = props;
  // lazy loads the application configuration and token
  const loadLogData = PromiseLazyLoad(() => {
    return Promise.all([getApplicationConfiguration({ application_uid }), getToken()]);
  });

  const url = new URL(ze_api_gateway.logs, ZE_API_ENDPOINT());

  return function logEvent(...logs): void {
    // Prints logs to the console as fast as possible
    for (const log of logs) {
      if (!log.level && !log.action) {
        throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
          message: 'Log level and action are required',
        });
      }

      logFn(log.level, log.message);
    }

    // Then attempt to upload logs,
    loadLogData()
      .then(
        ([config, token]) =>
          void makeRequest<unknown>(
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
                  application_uid: application_uid,
                  userId: config.user_uuid,
                  username: config.username,
                  zeBuildId: buildId,
                  logLevel: log.level,
                  actionType: log.action,
                  git: git,
                  message: stripAnsi(log.message.trim()),
                  createdAt: Date.now(),
                }))
            )
          )
      )
      // This is ok to fail silently
      .catch(() => void 0);
  };
}
