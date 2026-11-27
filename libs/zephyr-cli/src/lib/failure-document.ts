import { stripVTControlCharacters } from 'node:util';
import {
  getZephyrErrorCategory,
  redactString,
  ZephyrError,
  type ZephyrErrorCategory,
} from 'zephyr-agent';

export const FAILURE_DOCUMENT_SCHEMA_VERSION = '1.1.0';

/**
 * What `ze-cli deploy --format json` prints on stdout when it fails. The only document on
 * stdout, so a script can parse it whatever the outcome. Success prints the deploy result
 * instead, and the exit code tells the two apart.
 */
export interface FailureDocument {
  schemaVersion: typeof FAILURE_DOCUMENT_SCHEMA_VERSION;
  ok: false;
  error: {
    /**
     * Zephyr error code, for example `ZE50001`. `ZE00000` when the error is not a Zephyr
     * error.
     */
    code: string;
    /**
     * Code of the root cause when a wrapper error hides it, for example `ZE50001` behind
     * `ZE20014`. Absent otherwise.
     */
    reason?: string;
    kind: ZephyrErrorCategory;
    /** Redacted message without colors. */
    message: string;
    /**
     * URL of the version Zephyr kept although the deploy failed: a deploy a permission
     * profile denied (`ZE10038`). Absent otherwise. Added in schema 1.1.0.
     */
    versionUrl?: string;
  };
}

/** The kept version's URL from the error data, also on a wrapper's cause. */
function keptVersionUrl(error: unknown): string | undefined {
  for (let current = error; ZephyrError.is(current); current = current.cause) {
    const versionUrl = current.data?.['versionUrl'];
    if (typeof versionUrl === 'string' && versionUrl) return versionUrl;
  }
  return undefined;
}

export function createFailureDocument(error: unknown): FailureDocument {
  const zephyrError = ZephyrError.is(error) ? error : undefined;
  const message =
    zephyrError?.message ??
    (error instanceof Error ? error.message : String(error ?? 'Unknown error'));
  const versionUrl = keptVersionUrl(error);
  return {
    schemaVersion: FAILURE_DOCUMENT_SCHEMA_VERSION,
    ok: false,
    error: {
      code: zephyrError?.code ?? 'ZE00000',
      ...(zephyrError?.reason && zephyrError.reason !== zephyrError.code
        ? { reason: zephyrError.reason }
        : {}),
      kind: getZephyrErrorCategory(error),
      message: stripVTControlCharacters(redactString(message)),
      ...(versionUrl ? { versionUrl } : {}),
    },
  };
}
