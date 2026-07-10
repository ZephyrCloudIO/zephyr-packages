import type { AxiosRequestConfig } from 'axios';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import isCI from 'is-ci';
import { ZeErrors, ZephyrError } from '../errors';
import {
  redactString,
  redactUrl,
  safeStringifyForLogging,
  sanitizeForLogging,
} from '../security/redaction';

const IPV4_FAMILY = 4;
export const DEFAULT_HTTP_DEADLINE_MS = 30_000;
const RETRY_BASE_DELAY_MS = 100;
const RETRY_ERROR_CODES = [
  'ETIMEDOUT',
  'ECONNABORTED',
  'ENETUNREACH',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ENOTFOUND',
  'EPIPE',
];
const RETRY_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429]);

function hasIdempotencyKey(headers: HeadersInit | undefined): boolean {
  if (!headers) return false;
  if (headers instanceof Headers) return headers.has('idempotency-key');
  if (Array.isArray(headers)) {
    return headers.some(([key]) => key.toLowerCase() === 'idempotency-key');
  }
  return Object.keys(headers).some((key) => key.toLowerCase() === 'idempotency-key');
}

/**
 * Gets HTTPS proxy URL from environment variables. Checks both uppercase and lowercase
 * variants. Falls back to HTTP_PROXY if HTTPS_PROXY is not set. Returns undefined if no
 * proxy is configured.
 */
function getHttpsProxyUrl(): string | undefined {
  const envVars = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'];

  for (const envVar of envVars) {
    const value = process.env[envVar];
    if (value) {
      return value;
    }
  }
  return undefined;
}

/**
 * Checks if a host should bypass the proxy based on NO_PROXY environment variable.
 * NO_PROXY is a comma-separated list of hosts that should not use the proxy.
 */
function shouldBypassProxy(hostname: string): boolean {
  const noProxy = process.env['NO_PROXY'] || process.env['no_proxy'];
  if (!noProxy) {
    return false;
  }

  const noProxyList = noProxy.split(',').map((h) => h.trim().toLowerCase());
  const hostLower = hostname.toLowerCase();

  return noProxyList.some((noProxyHost) => {
    if (noProxyHost === '*') {
      return true;
    }
    // Handle wildcard domains like .example.com
    if (noProxyHost.startsWith('.')) {
      return hostLower.endsWith(noProxyHost) || hostLower === noProxyHost.slice(1);
    }
    return hostLower === noProxyHost || hostLower.endsWith(`.${noProxyHost}`);
  });
}

/** Creates HTTPS agent with proxy support if configured via environment variables. */
function getHttpsProxyAgent(url: URL): HttpsProxyAgent<string> | undefined {
  // Check if this host should bypass the proxy
  if (shouldBypassProxy(url.hostname)) {
    return undefined;
  }

  const httpsProxyUrl = getHttpsProxyUrl();
  return httpsProxyUrl ? new HttpsProxyAgent(httpsProxyUrl) : undefined;
}

interface HttpLikeError {
  code?: string;
  message?: string;
  response?: {
    status: number;
    data?: unknown;
  };
}

function toHttpLikeError(error: unknown): HttpLikeError {
  if ((typeof error === 'object' && error !== null) || typeof error === 'function') {
    return error as HttpLikeError;
  }
  return { message: String(error) };
}

function isRetryableNetworkError(error: unknown): boolean {
  const candidate = toHttpLikeError(error);
  if (candidate.response) return false;

  const message = String(candidate.message ?? '').toLowerCase();
  return Boolean(
    (candidate.code && RETRY_ERROR_CODES.includes(candidate.code)) ||
    message.includes('network') ||
    message.includes('timeout')
  );
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status) || status >= 500;
}

async function waitForRetry(
  retryIndex: number,
  deadline: number,
  signal?: AbortSignal | null,
  retryAfterMs = 0
): Promise<boolean> {
  if (signal?.aborted) return false;

  const remaining = deadline - Date.now();
  const delay = Math.min(
    Math.max(RETRY_BASE_DELAY_MS * 2 ** retryIndex, retryAfterMs),
    remaining - 1
  );
  if (delay <= 0) return false;

  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, delay);

    function done(): void {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }

    signal?.addEventListener('abort', done, { once: true });
  });

  return !signal?.aborted && Date.now() < deadline;
}

function getRetryAfterMs(headers: unknown): number {
  const candidate = headers as {
    get?: (name: string) => unknown;
    [key: string]: unknown;
  } | null;
  const value = candidate?.get?.('retry-after') ?? candidate?.['retry-after'];
  if (value === undefined || value === null) return 0;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const retryDate = Date.parse(String(value));
  return Number.isNaN(retryDate) ? 0 : Math.max(0, retryDate - Date.now());
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    try {
      return String(value);
    } catch {
      return '[unserializable value]';
    }
  }
}

function toResponse(response: {
  status: number;
  headers: unknown;
  data: unknown;
}): Response {
  const headers = Object.entries(response.headers ?? {}).reduce(
    (acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = typeof value === 'string' ? value : String(value);
      }
      return acc;
    },
    {} as Record<string, string>
  );

  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    headers: new Headers(headers),
    text: async () => {
      return stringifyUnknown(response.data);
    },
    json: async () => response.data,
  } as Response;
}

function normalizeRequestError(error: unknown, url: URL, method: string): Error {
  if (error instanceof ZephyrError) return error;

  const candidate = toHttpLikeError(error);
  if (candidate.response) {
    return new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
      status: candidate.response.status,
      url: redactUrl(url),
      content:
        typeof candidate.response.data === 'string'
          ? redactString(candidate.response.data)
          : safeStringifyForLogging(candidate.response.data),
      method,
    });
  }

  if (isRetryableNetworkError(error) || candidate.code === 'ERR_CANCELED') {
    return new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
      status: -1,
      url: redactUrl(url),
      content:
        candidate.code === 'ERR_CANCELED'
          ? 'Request canceled'
          : redactString(
              `Request failed after retries: ${candidate.code ?? candidate.message}`
            ),
      method,
    });
  }

  return new ZephyrError(ZeErrors.ERR_UNKNOWN, {
    message: 'Unknown error occurred',
    cause: sanitizeForLogging(error),
  });
}

export async function fetchWithRetries(
  url: URL,
  options: RequestInit = {},
  retries = 3,
  deadlineMs = DEFAULT_HTTP_DEADLINE_MS
): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  // Mutation requests remain single-shot unless the caller explicitly supplies a
  // stable idempotency key for an endpoint which can safely deduplicate replays.
  const retrySafe = RETRY_SAFE_METHODS.has(method) || hasIdempotencyKey(options.headers);
  const maxRetries =
    retrySafe && Number.isFinite(retries) ? Math.max(0, Math.floor(retries)) : 0;
  const boundedDeadlineMs = Number.isFinite(deadlineMs)
    ? Math.max(1, deadlineMs)
    : DEFAULT_HTTP_DEADLINE_MS;
  const deadline = Date.now() + boundedDeadlineMs;

  // Get HTTPS proxy agent if configured via environment variables
  const httpsAgent = getHttpsProxyAgent(url);

  // Create a custom axios instance for this request with CI-friendly settings.
  // validateStatus keeps HTTP responses in-band so callers can handle 401/403.
  const axiosInstance = axios.create({
    // Force IPv4 in CI environments to avoid IPv6 connectivity issues
    // References: https://github.com/actions/runner/issues/3138
    // https://x.com/matteocollina/status/1640384245834055680
    family: isCI ? IPV4_FAMILY : undefined,
    httpsAgent,
    validateStatus: () => true,
  });

  // Convert fetch options to axios options
  const axiosConfig: AxiosRequestConfig = {
    method,
    data: options.body,
    ...(options.signal ? { signal: options.signal } : {}),
  };

  if (options.headers) {
    if (options.headers instanceof Headers) {
      const headersRecord: Record<string, string> = {};
      options.headers.forEach((value, key) => {
        headersRecord[key] = value;
      });
      axiosConfig.headers = headersRecord;
    } else if (Array.isArray(options.headers)) {
      const headersRecord: Record<string, string> = {};
      options.headers.forEach(([key, value]) => {
        headersRecord[key] = value;
      });
      axiosConfig.headers = headersRecord;
    } else {
      axiosConfig.headers = options.headers;
    }
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axiosInstance(url.toString(), {
        ...axiosConfig,
        timeout: Math.max(1, deadline - Date.now()),
      });

      if (
        attempt < maxRetries &&
        isRetryableStatus(response.status) &&
        (await waitForRetry(
          attempt,
          deadline,
          options.signal,
          getRetryAfterMs(response.headers)
        ))
      ) {
        continue;
      }

      return toResponse(response);
    } catch (error) {
      const canRetry =
        attempt < maxRetries &&
        !options.signal?.aborted &&
        isRetryableNetworkError(error) &&
        (await waitForRetry(attempt, deadline, options.signal));

      if (canRetry) continue;
      throw normalizeRequestError(error, url, method);
    }
  }

  // The loop always returns or throws. This guard keeps the contract explicit.
  throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
    message: 'HTTP retry loop exited unexpectedly',
  });
}
