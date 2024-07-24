import {
  ZEPHYR_API_ENDPOINT,
  brightBlueBgName,
  brightRedBgName,
  brightYellowBgName,
  getToken,
  is_debug_enabled,
  request,
  v2_api_paths,
  ze_log,
} from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../application-configuration/get-application-configuration';
import { stripAnsi } from '../util/strip-ansi';

const log = (level: string, msg: unknown): void => {
  if (is_debug_enabled) {
    ze_log(msg);
    return;
  }

  switch (level) {
    case 'warn':
      console.warn(`${brightYellowBgName}  ${msg}`);
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

export interface LoggerOptions {
  application_uid: string;
  zeConfig: {
    buildId: string | undefined;
  };
  isCI: boolean;
  app: Record<string, unknown>;
  git: Record<string, unknown>;
}

export type LogEvent = (options: LogEventOptions) => void;

export function logger(options: LoggerOptions) {
  return function logEvent(...logs: LogEventOptions[]): void {
    Promise.all([
      getApplicationConfiguration({ application_uid: options.application_uid }),
      getToken(),
    ]).then(([{ username, user_uuid }, token]) => {
      for (const { level, action, message, meta } of logs) {
        if (!level && !action) {
          throw new Error('log level and action type must be provided');
        }

        const newMeta = Object.assign({}, meta, {
          isCI: options.isCI,
          app: options.app,
          git: options.git,
        });

        const newMessage = message.trim();
        const data = JSON.stringify({
          application_uid: options.application_uid,
          userId: user_uuid,
          username,
          zeBuildId: options.zeConfig.buildId,
          logLevel: level,
          actionType: action,
          git: options.git,
          message: stripAnsi(newMessage),
          meta: newMeta,
          createdAt: Date.now(),
        });

        const reqOptions = {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': data.length,
          },
        };

        log(level, newMessage);

        const url = new URL(
          v2_api_paths.application_logs,
          ZEPHYR_API_ENDPOINT()
        );

        void request(url, reqOptions, data).catch(() => void 0);
      }
    });
  };
}
