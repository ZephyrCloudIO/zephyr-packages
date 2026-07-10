const REDACTED = '[REDACTED]';
const CIRCULAR = '[Circular]';
const TRUNCATED = '[Truncated]';
const MAX_DEPTH = 10;
const MAX_NODES = 2_000;

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"'`\p{Cc}]+/giu;
const BEARER_TOKEN = /\b(Bearer\s+)[^\s,;"'}\]]+/giu;
const JWT_TOKEN = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu;
const COOKIE_HEADER = /\b(cookie|set-cookie)(\s*:\s*)[^\r\n]*/giu;
const SENSITIVE_ASSIGNMENT =
  /((?:["']?(?:x-amz-(?:credential|signature|security-token)|authorization|proxy-authorization|cookie|set-cookie|(?:[a-z0-9_-]*(?:token|secret|password|passwd|credential|signature|session|state|jwt|csrf)[a-z0-9_-]*)|(?:authorization|auth|oauth)?code)["']?)\s*(?::|=)\s*)("[^"]*"|'[^']*'|[^,\s;&}\]]+)/giu;
const SENSITIVE_WORD_VALUE =
  /\b(token|secret|password|passwd|credential|signature|session|state|jwt|code)(\s+)([^\s,;"'}\]]+)/giu;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSafeDiagnosticCode(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    (/^ZE\d{5}$/u.test(value) || /^E[A-Z][A-Z0-9_]{2,}$/u.test(value))
  );
}

function isSensitiveKey(key: string, value: unknown): boolean {
  const normalized = normalizeKey(key);

  if (normalized === 'code') return !isSafeDiagnosticCode(value);

  return (
    normalized === 'authorization' ||
    normalized === 'proxyauthorization' ||
    normalized === 'cookie' ||
    normalized === 'setcookie' ||
    normalized.includes('token') ||
    normalized.includes('secret') ||
    normalized.includes('password') ||
    normalized.includes('passwd') ||
    normalized.includes('credential') ||
    normalized.includes('signature') ||
    normalized.includes('session') ||
    normalized.includes('state') ||
    normalized.includes('jwt') ||
    normalized.includes('csrf') ||
    normalized === 'authcode' ||
    normalized === 'authorizationcode' ||
    normalized === 'oauthcode'
  );
}

function splitTrailingPunctuation(value: string): [url: string, trailing: string] {
  let url = value;
  let trailing = '';

  while (url.length > 0 && /[),.;\]}]/u.test(url.at(-1) ?? '')) {
    trailing = `${url.at(-1)}${trailing}`;
    url = url.slice(0, -1);
  }

  return [url, trailing];
}

function unquote(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function isSafeCodeAssignment(prefix: string, value: string): boolean {
  const key = prefix.match(/^["']?([^"':=\s]+)["']?\s*(?::|=)/u)?.[1];
  const diagnostic = unquote(value).replace(/[).]+$/u, '');
  return normalizeKey(key ?? '') === 'code' && isSafeDiagnosticCode(diagnostic);
}

/**
 * Redact credentials from a URL while retaining its origin, path, and query parameter
 * names. Query values and fragments are intentionally never considered safe for logs.
 */
export function redactUrl(value: URL | string): string {
  const input = value instanceof URL ? value.toString() : value;

  try {
    // Redaction is a logging concern and must never alter a live request URL. This is
    // especially important for presigned URLs whose query values are part of the
    // signature.
    const url = new URL(input);

    if (url.username) url.username = REDACTED;
    if (url.password) url.password = REDACTED;

    for (const key of new Set(url.searchParams.keys())) {
      url.searchParams.set(key, REDACTED);
    }

    if (url.hash) url.hash = REDACTED;

    return url.toString();
  } catch {
    return redactNonUrlText(input);
  }
}

function redactNonUrlText(value: string): string {
  return value
    .replace(
      COOKIE_HEADER,
      (_match, key: string, separator: string) => `${key}${separator}${REDACTED}`
    )
    .replace(BEARER_TOKEN, `$1${REDACTED}`)
    .replace(JWT_TOKEN, REDACTED)
    .replace(SENSITIVE_ASSIGNMENT, (match, prefix: string, assignedValue: string) =>
      isSafeCodeAssignment(prefix, assignedValue) ? match : `${prefix}${REDACTED}`
    )
    .replace(
      SENSITIVE_WORD_VALUE,
      (match, key: string, whitespace: string, assignedValue: string) =>
        normalizeKey(key) === 'code' &&
        isSafeDiagnosticCode(unquote(assignedValue).replace(/[).]+$/u, ''))
          ? match
          : `${key}${whitespace}${REDACTED}`
    );
}

/** Redact URLs, authorization values, and secret-like assignments in arbitrary text. */
export function redactString(value: string): string {
  const withoutUrlSecrets = value.replace(URL_IN_TEXT, (candidate) => {
    const [url, trailing] = splitTrailingPunctuation(candidate);
    return `${redactUrl(url)}${trailing}`;
  });

  return redactNonUrlText(withoutUrlSecrets);
}

interface SanitizerState {
  depth: number;
  nodes: number;
  seen: WeakSet<object>;
}

function sanitizeValue(
  value: unknown,
  key: string | undefined,
  state: SanitizerState
): unknown {
  if (key && isSensitiveKey(key, value)) return REDACTED;
  if (value === null || value === undefined) return value;

  switch (typeof value) {
    case 'string':
      return redactString(value);
    case 'number':
    case 'boolean':
      return value;
    case 'bigint':
    case 'symbol':
    case 'function':
      return redactString(String(value));
    default:
      break;
  }

  if (state.depth >= MAX_DEPTH || state.nodes >= MAX_NODES) return TRUNCATED;

  const object = value as object;
  if (state.seen.has(object)) return CIRCULAR;
  state.seen.add(object);

  const childState = { ...state, depth: state.depth + 1, nodes: state.nodes + 1 };
  state.nodes += 1;

  if (value instanceof URL) return redactUrl(value);
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;
  if (ArrayBuffer.isView(value))
    return `[${value.constructor.name} ${value.byteLength} bytes]`;
  if (value instanceof ArrayBuffer) return `[ArrayBuffer ${value.byteLength} bytes]`;

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, undefined, childState));
  }

  if (value instanceof Map) {
    return Array.from(value.entries(), ([mapKey, mapValue]) => [
      sanitizeValue(mapKey, undefined, childState),
      sanitizeValue(mapValue, String(mapKey), childState),
    ]);
  }

  if (value instanceof Set) {
    return Array.from(value, (entry) => sanitizeValue(entry, undefined, childState));
  }

  const output: Record<string, unknown> = {};

  if (value instanceof Error) {
    output['name'] = redactString(value.name);
    output['message'] = redactString(value.message);
    if (value.stack) output['stack'] = redactString(value.stack);
  }

  let keys: string[];
  try {
    keys = Object.keys(object);
  } catch {
    return '[Uninspectable object]';
  }

  for (const property of keys) {
    if (property in output) continue;

    try {
      output[property] = sanitizeValue(
        (object as Record<string, unknown>)[property],
        property,
        childState
      );
    } catch {
      output[property] = '[Uninspectable value]';
    }
  }

  return output;
}

/**
 * Convert an arbitrary value into an acyclic, bounded, secret-redacted representation
 * suitable for console, file, and error logs.
 */
export function sanitizeForLogging(value: unknown): unknown {
  try {
    return sanitizeValue(value, undefined, {
      depth: 0,
      nodes: 0,
      seen: new WeakSet<object>(),
    });
  } catch {
    return '[Unserializable value]';
  }
}

/** Safely serialize arbitrary log metadata after redaction. */
export function safeStringifyForLogging(value: unknown, space?: number): string {
  try {
    return JSON.stringify(sanitizeForLogging(value), null, space) ?? 'undefined';
  } catch {
    return redactString(String(value));
  }
}

export { REDACTED };
