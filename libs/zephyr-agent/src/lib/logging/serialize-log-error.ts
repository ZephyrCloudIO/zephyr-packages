import { stripAnsi } from 'zephyr-edge-contract';
import { ZeErrors } from '../errors/codes';
import { ZephyrError } from '../errors/zephyr-error';
import { redactString } from '../security/redaction';

/** The `error` group of a remote log event. */
export interface SerializedLogError {
  /** `ZephyrError` code (`ZE20017`), a Node error code (`ECONNRESET`), or `ZE00000`. */
  code: string;
  name: string;
  /** Redacted, single error message without terminal colors. */
  message: string;
  /** HTTP status of the response that caused the error, when there was one. */
  cause_status?: number;
}

const MAX_MESSAGE_LENGTH = 2_000;
const MAX_CAUSE_DEPTH = 5;
const UNKNOWN_CODE = ZephyrError.toZeCode(ZeErrors.ERR_UNKNOWN);
const NODE_ERROR_CODE = /^E[A-Z][A-Z0-9_]{2,}$/;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function toHttpStatus(value: unknown): number | undefined {
  const status = typeof value === 'string' ? Number(value) : value;
  return typeof status === 'number' &&
    Number.isInteger(status) &&
    status >= 100 &&
    status <= 599
    ? status
    : undefined;
}

/**
 * Finds the HTTP status behind an error. Zephyr keeps it in `template.status` (HTTP
 * errors) or `data.status` (unreachable errors), axios in `response.status`, and wrapping
 * errors in `cause`.
 */
function findCauseStatus(error: unknown, depth = 0): number | undefined {
  const record = asRecord(error);
  if (!record || depth > MAX_CAUSE_DEPTH) return undefined;

  return (
    toHttpStatus(asRecord(record['template'])?.['status']) ??
    toHttpStatus(asRecord(record['data'])?.['status']) ??
    toHttpStatus(asRecord(record['response'])?.['status']) ??
    toHttpStatus(record['status']) ??
    findCauseStatus(record['cause'], depth + 1)
  );
}

function errorCode(error: unknown): string {
  if (ZephyrError.is(error)) return error.code;
  const code = asRecord(error)?.['code'];
  return typeof code === 'string' && NODE_ERROR_CODE.test(code) ? code : UNKNOWN_CODE;
}

function errorName(error: unknown): string {
  if (!(error instanceof Error)) return 'NonError';
  // ZephyrError and many libraries leave `name` as the base "Error".
  const name =
    error.name && error.name !== 'Error' ? error.name : error.constructor?.name;
  return name || 'Error';
}

function errorMessage(error: unknown): string {
  let message: string;
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    try {
      message = JSON.stringify(error) ?? String(error);
    } catch {
      message = String(error);
    }
  }
  const clean = redactString(stripAnsi(message)).trim();
  return clean.length > MAX_MESSAGE_LENGTH
    ? `${clean.slice(0, MAX_MESSAGE_LENGTH)}…`
    : clean;
}

/**
 * Serializes any thrown value into the `error` group of a remote log event. It never
 * throws, and the message is redacted.
 */
export function serializeLogError(error: unknown): SerializedLogError {
  try {
    const serialized: SerializedLogError = {
      code: errorCode(error),
      name: errorName(error),
      message: errorMessage(error),
    };
    const causeStatus = findCauseStatus(error);
    if (causeStatus !== undefined) serialized.cause_status = causeStatus;
    return serialized;
  } catch {
    return { code: UNKNOWN_CODE, name: 'Error', message: '[Unserializable error]' };
  }
}
