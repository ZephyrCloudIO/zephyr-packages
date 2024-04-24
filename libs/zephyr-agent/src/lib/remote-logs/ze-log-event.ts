import { is_debug_enabled } from 'zephyr-edge-contract';
import { request } from 'zephyr-edge-contract';
import {
  getToken,
  ze_error,
  ze_log,
  ZEPHYR_API_ENDPOINT,
} from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../application-configuration/get-application-configuration';

const log = (level: string, msg: unknown): void => {
  if (level === 'warn') {
    return is_debug_enabled ? ze_log(msg) : console.warn(msg);
  }
  if (level === 'error') {
    return is_debug_enabled ? ze_error(msg) : console.error(msg);
  }
  return is_debug_enabled ? ze_log(msg) : console.log(msg);
};

interface LogEventOptions {
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

export function logger(options: LoggerOptions) {
  return function logEvent({ level, action, message, meta }: LogEventOptions) {
    const application_uid = options.application_uid;
    Promise.all([
      getApplicationConfiguration({ application_uid }),
      getToken(),
    ]).then(([application_config, token]) => {
      const { username, user_uuid } = application_config;
      const zeBuildId = options.zeConfig.buildId;
      const git = options.git;
      const createdAt = Date.now();

      if (!level && !action) {
        throw new Error('log level and action type must be provided');
      }

      message = `[${options.application_uid}](${username})[${zeBuildId}]: ${message}`;
      meta = Object.assign({}, meta, {
        isCI: options.isCI,
        app: options.app,
        git: options.git,
      });

      const data = JSON.stringify({
        application_uid,
        userId: user_uuid,
        username,
        zeBuildId,
        logLevel: level,
        actionType: action,
        git,
        message,
        meta,
        createdAt,
      });

      const reqOptions = {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      };

      log(level, `[zephyr]: ${message}`);
      const url = new URL(`/v2/application/logs`, ZEPHYR_API_ENDPOINT);
      request(url, reqOptions, data).catch(() => void 0);
    });
  };
}
