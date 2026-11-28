import { ZeErrors, ZephyrError } from 'zephyr-agent';

/** The one sentence every relative path rule reports. */
export const RELATIVE_PATH_RULE =
  "must be a relative path using '/', without '..' or a drive letter";

/**
 * Whether `value` is a relative path or glob, as used by `output`, `include` and
 * `exclude`: no leading `/` or `\`, no drive letter, no UNC path, no `\` at all, and no
 * `..` segment. The schema `pattern` in `schema/zephyr.config.schema.json` states the
 * same rule for editors and for the config file.
 */
export function isRelativePathOrGlob(value: string): boolean {
  if (value === '') return false;
  if (value.startsWith('/') || value.startsWith('\\')) return false;
  if (/^[A-Za-z]:/.test(value)) return false;
  if (value.includes('\\')) return false;
  return !value.split('/').includes('..');
}

/** Throws a `ZephyrError` naming `label` when `value` is not a relative path or glob. */
export function assertRelativePathOrGlob(value: string, label: string): void {
  if (!isRelativePathOrGlob(value)) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `${label} ${RELATIVE_PATH_RULE}: "${value}"`,
    });
  }
}
