// extracted from https://github.com/chalk/ansi-regex/blob/main/index.js
// and https://github.com/chalk/strip-ansi/blob/main/index.d.ts

const ANSI_REGEX = new RegExp(
  [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
  ].join('|'),
  'g'
);

/**
 * Strip [ANSI escape codes](https://en.wikipedia.org/wiki/ANSI_escape_code) from a
 * string.
 *
 * @example
 *   ```
 *   import stripAnsi from 'strip-ansi';
 *
 *   stripAnsi('\u001B[4mUnicorn\u001B[0m');
 *   //=> 'Unicorn'
 *
 *   stripAnsi('\u001B]8;;https://github.com\u0007Click\u001B]8;;\u0007');
 *   //=> 'Click'
 *   ```;
 */
export function stripAnsi(string: string): string {
  return string.replace(ANSI_REGEX, '');
}
