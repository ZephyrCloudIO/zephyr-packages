import {
  getZephyrErrorCategory,
  redactString,
  ZephyrError,
  type ZephyrErrorCategory,
} from 'zephyr-agent';

/** Version of the failure document. Bump the major version for a breaking change. */
export const FAILURE_DOCUMENT_SCHEMA_VERSION = '1.0.0';

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
    /**
     * Category of the root cause: `unreachable` (Zephyr cannot be reached or failed on
     * its side), `auth`, `forbidden`, `config`, `build`, `deploy`, `browser` or
     * `unknown`.
     */
    kind: ZephyrErrorCategory;
    /** Redacted message without colors. */
    message: string;
  };
}

export function createFailureDocument(error: unknown): FailureDocument {
  const zephyrError = ZephyrError.is(error) ? error : undefined;
  const message =
    zephyrError?.message ??
    (error instanceof Error ? error.message : String(error ?? 'Unknown error'));
  return {
    schemaVersion: FAILURE_DOCUMENT_SCHEMA_VERSION,
    ok: false,
    error: {
      code: zephyrError?.code ?? 'ZE00000',
      ...(zephyrError?.reason && zephyrError.reason !== zephyrError.code
        ? { reason: zephyrError.reason }
        : {}),
      kind: getZephyrErrorCategory(error),
      message: redactString(message),
    },
  };
}
