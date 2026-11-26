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
import { writeLogToFile, isFileLoggingEnabled } from './file-logger';
import { redactString, safeStringifyForLogging } from '../security/redaction';
import { withRequestIdentity } from '../http/request-identity';
import { serializeLogError } from './serialize-log-error';
import { DEFAULT_LOG_FLUSH_TIMEOUT_MS, settleWithin } from '../utils/settle-within';

export const logFn = (level: string, msg: unknown, action?: string): void => {
  const messageStr = redactString(String(msg));

  // Write to file if enabled
  if (isFileLoggingEnabled()) {
    writeLogToFile({
      level: level as 'info' | 'warn' | 'error' | 'debug',
      message: messageStr,
      action,
      timestamp: Date.now(),
    });
  }

  // Always output plain formatted to console
  const formatted = formatLogMsg(messageStr, level);

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

export function formatLogMsg(msg: string, level = 'info') {
  return redactString(msg)
    .split('\n')
    .map((m) => `${toLevelPrefix(level)}  ${m.trimEnd()}`)
    .join('\n');
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface LogEventOptions {
  level: string;
  action: string;
  /** Human-readable text, printed to the console and sent as is. */
  message: string;
  table?: { key: string; value: (string | undefined)[] }[];
  ignore?: boolean;
  /** Send remotely without printing, for an error the caller already prints or throws. */
  remoteOnly?: boolean;
  /** Structured facts for this event, using the snake_case names in `ZeLogFields`. */
  data?: Record<string, JsonValue>;
  /** The error behind a failure event, sent as `{ code, name, message, cause_status? }`. */
  error?: unknown;
}

/** Build facts sent as the `context` group of every remote log event. */
export interface LogContext {
  builder?: string;
  plugin?: string;
  plugin_version?: string;
  agent_version?: string;
  node_version?: string;
  ci?: boolean;
  target?: string;
  env?: string;
}

export type LogEvent = (options: LogEventOptions) => void;

export interface ZeLogger {
  (...logs: LogEventOptions[]): void;
  /**
   * Waits for the remote log sends started so far, for at most `timeoutMs`. It never
   * rejects, so a slow or failing log endpoint cannot fail or hang a build.
   */
  flush(timeoutMs?: number): Promise<void>;
}

export { DEFAULT_LOG_FLUSH_TIMEOUT_MS };

interface LoggerOptions {
  application_uid: string;
  buildId?: string;
  git: ZeGitInfo['git'];
  /** Sent with every event. A function is read when each event is logged. */
  context?: LogContext | (() => LogContext);
}

function resolveContext(context: LoggerOptions['context']): LogContext | undefined {
  try {
    const value = typeof context === 'function' ? context() : context;
    if (!value) return undefined;
    // Omit unknowns so the field only carries facts.
    const known = Object.fromEntries(
      Object.entries(value).filter(
        ([, entry]) => entry !== undefined && entry !== null && entry !== ''
      )
    ) as LogContext;
    return Object.keys(known).length > 0 ? known : undefined;
  } catch {
    return undefined;
  }
}

export function logger(props: LoggerOptions): ZeLogger {
  const { application_uid, buildId, git, context } = props;
  // lazy loads the application configuration and token
  const loadLogData = PromiseLazyLoad(() => {
    return Promise.all([getApplicationConfiguration({ application_uid }), getToken()]);
  });

  const url = new URL(ze_api_gateway.logs, ZE_API_ENDPOINT());
  const pending = new Set<Promise<void>>();

  function send(logs: LogEventOptions[]): void {
    // some logs are empty to give newline effect in terminal
    const remoteLogs = logs.filter((l) => l.message.length && !l.ignore);
    if (remoteLogs.length === 0) return;

    // Capture everything now: errors and context can change before the send runs.
    const createdAt = Date.now();
    const eventContext = resolveContext(context);
    const events = remoteLogs.map((log) => ({
      logLevel: log.level,
      actionType: log.action,
      message: stripAnsi(log.message.trim()),
      createdAt,
      ...(eventContext ? { context: eventContext } : {}),
      ...(log.data && Object.keys(log.data).length > 0 ? { data: log.data } : {}),
      ...(log.error !== undefined ? { error: serializeLogError(log.error) } : {}),
    }));

    const delivery = loadLogData()
      .then(([config, token]) =>
        withRequestIdentity(
          {
            buildId,
            builder: eventContext?.builder,
            plugin: eventContext?.plugin,
            pluginVersion: eventContext?.plugin_version,
          },
          () =>
            makeRequest<unknown>(
              url,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                credentialToken: token,
              },
              // The whole payload, including context, data and error, is redacted here.
              safeStringifyForLogging(
                events.map((event) => ({
                  application_uid: application_uid,
                  userId: config.user_uuid,
                  username: config.username,
                  zeBuildId: buildId,
                  git: git,
                  ...event,
                }))
              )
            )
        )
      )
      // This is ok to fail silently
      .then(
        () => undefined,
        () => undefined
      );

    pending.add(delivery);
    void delivery.then(() => pending.delete(delivery));
  }

  function logEvent(...logs: LogEventOptions[]): void {
    // Prints logs to the console as fast as possible
    for (const log of logs) {
      if (!log.level && !log.action) {
        throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
          message: 'Log level and action are required',
        });
      }

      if (!log.remoteOnly) logFn(log.level, log.message, log.action);
    }

    // Then attempt to upload logs. Logging must never break the build.
    try {
      send(logs);
    } catch {
      // ignore
    }
  }

  return Object.assign(logEvent, {
    flush: (timeoutMs = DEFAULT_LOG_FLUSH_TIMEOUT_MS) =>
      settleWithin([...pending], timeoutMs),
  });
}
