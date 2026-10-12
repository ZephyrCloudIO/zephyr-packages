/**
 * The normative MIME table for skill files: lowercase extension to type, no parameters.
 * Every producer and server derives `mimeType` from it, so a file has the same type in
 * `catalog.json`, on the edge and over MCP.
 */
export const MIME_TYPES: Readonly<Record<string, string>> = {
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  json: 'application/json',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  toml: 'application/toml',
  xml: 'application/xml',
  html: 'text/html',
  css: 'text/css',
  csv: 'text/csv',
  js: 'text/javascript',
  mjs: 'text/javascript',
  cjs: 'text/javascript',
  jsx: 'text/javascript',
  ts: 'text/typescript',
  tsx: 'text/typescript',
  mts: 'text/typescript',
  cts: 'text/typescript',
  py: 'text/x-python',
  sh: 'text/x-shellscript',
  bash: 'text/x-shellscript',
  rb: 'text/x-ruby',
  go: 'text/x-go',
  rs: 'text/x-rust',
  sql: 'application/sql',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  zip: 'application/zip',
};

/** The type of any file whose extension is not in {@link MIME_TYPES}. */
export const DEFAULT_MIME_TYPE = 'application/octet-stream';

const TEXT_APPLICATION_TYPES = new Set([
  'application/json',
  'application/yaml',
  'application/toml',
  'application/xml',
  'application/sql',
  'image/svg+xml',
]);

// Node `extname` semantics, as zephyr-agent uses: a leading dot (`.md`) or a
// trailing one (`file.`) is no extension.
const extensionOf = (filePath: string): string | undefined => {
  const name = filePath.split('/').at(-1) ?? '';
  const dot = name.lastIndexOf('.');
  return dot <= 0 || dot === name.length - 1
    ? undefined
    : name.slice(dot + 1).toLowerCase();
};

/**
 * The MIME type of a skill file, from the normative table.
 *
 * @example
 *   ```ts
 *   mimeTypeFor('scripts/check.ts'); // 'text/typescript'
 *   mimeTypeFor('assets/logo.bin'); // 'application/octet-stream'
 *   ```;
 */
export function mimeTypeFor(filePath: string): string {
  const extension = extensionOf(filePath);
  return (
    (extension !== undefined &&
    Object.prototype.hasOwnProperty.call(MIME_TYPES, extension)
      ? MIME_TYPES[extension]
      : undefined) ?? DEFAULT_MIME_TYPE
  );
}

/**
 * Whether files of this type are text. A text-typed file is still served as a blob when
 * its bytes are not valid UTF-8.
 */
export function isTextMimeType(mimeType: string): boolean {
  return mimeType.startsWith('text/') || TEXT_APPLICATION_TYPES.has(mimeType);
}

const strictUtf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/** Decodes UTF-8, or returns `undefined` when the bytes are not valid UTF-8. */
export const decodeUtf8 = (bytes: Uint8Array): string | undefined => {
  try {
    return strictUtf8.decode(bytes);
  } catch {
    return undefined;
  }
};
