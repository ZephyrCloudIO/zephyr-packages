import { Agent, EnvHttpProxyAgent, request } from 'undici';
import type { Dispatcher } from 'undici';
import { isCI } from '../ci/is-ci';
import { ZeErrors, ZephyrError } from '../errors';

const IPV4_FAMILY = 4;
const RETRY_DELAY_MS = 100;
const RETRY_ERROR_CODES = [
  'ETIMEDOUT',
  'ENETUNREACH',
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
];

type RetryDispatcher = Dispatcher & {
  close?: () => Promise<void>;
};

type ProxyEnvOptions = {
  httpProxy?: string;
  httpsProxy?: string;
  noProxy?: string;
};

function getProxyEnvOptions(): ProxyEnvOptions {
  return {
    httpProxy: process.env['HTTP_PROXY'] ?? process.env['http_proxy'],
    httpsProxy: process.env['HTTPS_PROXY'] ?? process.env['https_proxy'],
    noProxy: process.env['NO_PROXY'] ?? process.env['no_proxy'],
  };
}

function hasProxyEnv({ httpProxy, httpsProxy }: ProxyEnvOptions): boolean {
  return Boolean(httpProxy || httpsProxy);
}

function createDispatcher(): RetryDispatcher | undefined {
  const proxyOptions = getProxyEnvOptions();
  const connect = isCI() ? { family: IPV4_FAMILY } : undefined;

  if (hasProxyEnv(proxyOptions)) {
    return new EnvHttpProxyAgent({
      ...proxyOptions,
      connect,
    });
  }

  return connect ? new Agent({ connect }) : undefined;
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }

  if (headers instanceof Headers) {
    const headersRecord: Record<string, string> = {};
    headers.forEach((value, key) => {
      headersRecord[key] = value;
    });
    return headersRecord;
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return headers;
}

function createResponseHeaders(
  headers: Record<string, string | string[] | undefined>
): Headers {
  const responseHeaders = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => responseHeaders.append(key, entry));
      continue;
    }
    responseHeaders.set(key, value);
  }

  return responseHeaders;
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === 'string' ? error : '';
}

function isRetryableNetworkError(error: unknown): boolean {
  const code = getErrorCode(error);
  const message = getErrorMessage(error).toLowerCase();

  return (
    (code !== undefined && RETRY_ERROR_CODES.includes(code)) ||
    message.includes('network') ||
    message.includes('timeout')
  );
}

function retryDelay(attempt: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, RETRY_DELAY_MS * 2 ** (attempt - 1));
  });
}

function createHttpError(
  url: URL,
  options: RequestInit,
  status: number,
  content: string
) {
  return new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
    status,
    url: url.toString(),
    content,
    method: options.method?.toUpperCase() ?? 'GET',
  });
}

export async function fetchWithRetries(
  url: URL,
  options: RequestInit = {},
  retries = 3
): Promise<Response> {
  const dispatcher = createDispatcher();
  const headers = normalizeHeaders(options.headers);
  const method = (options.method ?? 'GET').toUpperCase() as Dispatcher.HttpMethod;
  let attempt = 0;

  try {
    while (true) {
      try {
        const response = await request(url, {
          method,
          headers,
          body: options.body as Dispatcher.RequestOptions['body'],
          ...(options.signal ? { signal: options.signal } : {}),
          ...(dispatcher ? { dispatcher } : {}),
        });
        const content = await response.body.text();

        if (response.statusCode >= 500 && attempt < retries) {
          attempt += 1;
          await retryDelay(attempt);
          continue;
        }

        if (response.statusCode >= 400) {
          throw createHttpError(url, options, response.statusCode, content);
        }

        return {
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          headers: createResponseHeaders(response.headers),
          text: async () => content,
          json: async () => JSON.parse(content),
        } as Response;
      } catch (error) {
        if (error instanceof ZephyrError) {
          throw error;
        }

        if (isRetryableNetworkError(error)) {
          if (attempt < retries) {
            attempt += 1;
            await retryDelay(attempt);
            continue;
          }

          throw new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
            status: -1,
            url: url.toString(),
            content: `Max retries reached for network error: ${
              getErrorCode(error) ?? getErrorMessage(error)
            }`,
            method,
          });
        }

        throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
          message: 'Unknown error occurred',
          cause: error,
        });
      }
    }
  } finally {
    await dispatcher?.close?.();
  }
}
