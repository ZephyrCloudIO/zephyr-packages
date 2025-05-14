import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as util from 'node:util';
import {
  blackBright,
  blue,
  bold,
  cyanBright,
  underline,
  whiteBright,
} from '../logging/picocolor';
import {
  isZeErrorEqual,
  ZeErrorCategories,
  type ZeErrorCode,
  type ZeErrorCodes,
  type ZeErrorKeys,
  ZeErrors,
  type ZeErrorType,
} from './codes';
import { type FindTemplates, formatString, stripAnsi } from 'zephyr-edge-contract';

/** Options to construct {@linkcode ZephyrError}. */
export type ZephyrErrorOpts<T extends ZeErrorType> = {
  cause?: unknown;
  data?: Record<string, unknown>;
} & Record<FindTemplates<T['message']>, string | number | boolean>;

export const docsUrl = 'https://docs.zephyr-cloud.io/errors';
export const discordUrl = 'https://zephyr-cloud.io/discord';

/**
 * ZephyrError is the base class for every error thrown by our builder plugins.
 *
 * Some messages have templates that mus be replaced with the `data` object. Use `{{
 * example }}` or `{{ example = value }}` to have a default value
 *
 * It's a subclass of Error, so it can be used in try/catch blocks.
 */
export class ZephyrError<
  K extends ZeErrorKeys,
  T extends (typeof ZeErrors)[K] = (typeof ZeErrors)[K],
> extends Error {
  readonly code!: ZeErrorCode<K>;

  /** Additional data to be used in the error message */
  public data?: Record<string, unknown>;

  /** Data used when templating the message */
  readonly template?: Omit<ZephyrErrorOpts<T>, 'cause' | 'data'>;

  /**
   * Indicates the specific original cause of the error.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
   */
  readonly cause?: unknown;

  /**
   * Returns {@linkcode cause} if it's a `ZephyrError`, otherwise creates a new
   * `ZephyrError` for the provided type.
   */
  constructor(type: T, opts?: ZephyrErrorOpts<T>) {
    // Unwraps ERR_UNKNOWN if cause is known
    if (ZephyrError.is(opts?.cause)) {
      if (isZeErrorEqual(type, ZeErrors.ERR_UNKNOWN)) {
        return opts.cause as ZephyrError<K>;
      }

      // Use cause's data if none is provided
      if (!opts.data && opts.cause.data) {
        opts.data = opts.cause.data;
        opts.cause.data = undefined;
      }
    }

    let message: string = type.message;

    // replace all the templates
    if (opts) {
      message = formatString(type.message, opts);
    }

    super(message.trim());

    this.code = ZephyrError.toZeCode<K>(type);

    if (opts) {
      const { cause, data, ...template } = opts;
      this.template = template;
      this.data = data;
      this.cause = cause;
    }

    // Simpler stack traces in VIte
    if (process.env['VITE']) {
      (this as { _stack?: string })._stack = this.stack;
    }
  }

  /** Checks if the given error is a ZephyrError and optionally matches the given code. */
  static is<K extends ZeErrorKeys>(
    err: unknown,
    codeOrType?: (typeof ZeErrors)[K]
  ): err is ZephyrError<K> {
    if (!(err instanceof ZephyrError)) {
      return false;
    }

    // No kind to filter
    if (!codeOrType) {
      return true;
    }

    return ZephyrError.toZeCode(codeOrType) === err.code;
  }

  /** Formats a Zephyr error code. */
  static toZeCode<K extends ZeErrorKeys>({ id, kind }: (typeof ZeErrors)[K]) {
    const prefix = ZeErrorCategories[kind];

    // we have less categories and more errors, so make sense to be ZEPPIII
    // where ZE is a constant, PP is the category, and I is the error id
    const paddedId = id.toString().padStart(3, '0');
    const paddedPrefix = prefix.toString().padStart(2, '0');

    return `ZE${paddedPrefix}${paddedId}` as ZeErrorCode<K>;
  }

  /**
   * Parses a Zephyr error code into a ZeErrorType.
   *
   * Returns {@linkcode ZeErrors.ERR_UNKNOWN} if the code could not be resolved.
   */
  static fromZeCode(code: ZeErrorCodes): ZeErrorType {
    // ZEPPIII -> ZE PP III -> ZE (2) (3)
    const prefix = code.slice(2, 4);
    const id = code.slice(4);

    let category: undefined | keyof typeof ZeErrorCategories;

    for (const errorCategory of Object.keys(
      ZeErrorCategories
    ) as (keyof typeof ZeErrorCategories)[]) {
      if (ZeErrorCategories[errorCategory] === prefix) {
        category = errorCategory;
        break;
      }
    }

    if (!category) {
      return ZeErrors.ERR_UNKNOWN;
    }

    for (const error of Object.values(ZeErrors)) {
      if (+error.id === +id && error.kind === category) {
        return error;
      }
    }

    return ZeErrors.ERR_UNKNOWN;
  }

  static format(error: unknown, customMessage?: string): string {
    const zeError = ZephyrError.is(error)
      ? error
      : new ZephyrError(ZeErrors.ERR_UNKNOWN, {
          message: customMessage || (error as Error)?.message || String(error),
          cause: error,
        });

    const tmpFile = write_error_file(zeError);

    // Strings don't need to be inspected.
    const inspected =
      typeof zeError.data === 'object'
        ? util.inspect(zeError.data, false, 5, true)
        : zeError.data;

    const messages = [
      `${bold(underline(zeError.code))}: ${zeError.message}`,

      `

Visit ${cyanBright(`${docsUrl}/${zeError.code}`)} for more information
Or join our ${blue('Discord')} server at ${cyanBright(discordUrl)}

`.trim(),

      inspected !== '{}' && inspected,

      tmpFile &&
        blackBright(`Complete error details available at ${whiteBright(tmpFile)}`),
    ];

    return messages
      .filter((x): x is string => !!x)
      .map((x) => x.trim())
      .join('\n\n');
  }
}

/** Attempts to write the error to a file in the temp directory. */
function write_error_file(zeError: ZephyrError<ZeErrorKeys>) {
  try {
    const tempPath = path.join(os.tmpdir(), `ze${Math.round(Math.random() * 10e9)}.json`);

    fs.writeFileSync(tempPath, JSON.stringify(format_error(zeError)), 'utf8');

    return tempPath;
  } catch {
    return undefined;
  }
}

function format_error(err: unknown): unknown {
  if (!err) {
    return undefined;
  }

  const error = err as ZephyrError<ZeErrorKeys>;

  return {
    ...error,
    template: undefined,
    ...error?.template,
    data: error?.data,
    message: error?.message,
    stack: split_stack(error.stack, error.message),
    cause: format_error(error.cause),
  };
}

function split_stack(stack?: string, message?: string) {
  if (!stack) {
    return undefined;
  }

  // removes message from stack
  if (message) {
    stack = stack.slice(`Error: ${message}\n`.length);
  }

  return stack.split('\n').map((line) => stripAnsi(line.trim()));
}
