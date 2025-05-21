import { ZeErrors, ZephyrError } from '../errors';
import { cleanTokens } from '../node-persist/token';
import { ze_log } from '../logging/debug';
import {
  safe_json_parse,
  ZE_API_ENDPOINT_HOST,
  ZE_IS_PREVIEW,
  ZEPHYR_API_ENDPOINT,
} from 'zephyr-edge-contract';
import { fetchWithRetries } from './fetch-with-retries';

/** Http request wrapper that returns a tuple with the response data or an error. */
export type HttpResponse<T> =
  | [ok: true, error: null, data: T]
  | [ok: false, error: Error];

export type UrlString =
  | string
  | URL
  | {
      path: string;
      base?: string;
      query: Record<string, string | number | boolean>;
    };

/** Parses the URL string into a URL object */
export function parseUrl(urlStr: UrlString): URL {
  if (typeof urlStr === 'string') {
    return new URL(urlStr);
  } else if (urlStr instanceof URL) {
    return urlStr;
  } else {
    const url = new URL(urlStr.path, urlStr.base);

    for (const [key, value] of Object.entries(urlStr.query)) {
      url.searchParams.append(key, String(value));
    }

    // Add a query param hint in preview environments
    const is_preview = ZE_IS_PREVIEW();
    const ze_api_endpoint_host = ZE_API_ENDPOINT_HOST();
    const zephyr_api_endpoint = ZEPHYR_API_ENDPOINT();

    if (is_preview && url.host === ze_api_endpoint_host) {
      url.searchParams.set('api_host', zephyr_api_endpoint);
    }

    return url;
  }
}

/** Creates a redacted string of the response for logging */
function redactResponse(
  url: URL,
  options: RequestInit,
  data?: string | Buffer,
  response?: unknown,
  startTime = Date.now()
): string {
  const str = [
    `[${options.method || 'GET'}][${url}]: ${Date.now() - startTime}ms`,
    data?.length ? ` - ${((data.length ?? 0) / 1024).toFixed(2)}kb` : '',
    response ? `Response: ${response}` : '',
    options ? `Options: ${JSON.stringify(options)}` : '',
  ].join('\n');

  return str
    .replace(/Bearer ([^"|']+)/gi, 'Bearer [REDACTED]')
    .replace(/"?jwt"?:["|\W']{0,2}([^"|']+)(["|'])/gi, 'jwt: [REDACTED]');
}

/** Main HTTP request function that handles the request and response */
export async function makeHttpRequest<T = void>(
  url: URL,
  options: RequestInit = {},
  data?: string | Buffer
): Promise<HttpResponse<T>> {
  const startTime = Date.now();

  try {
    const response = await fetchWithRetries(url, {
      ...options,
      body: data,
    });

    const resText = await response.text();

    if (response.status === 401) {
      // Clean the tokens and throw an error
      await cleanTokens();
      throw new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
        message: 'Unauthenticated request',
      });
    }

    if (response.status === 403) {
      throw new ZephyrError(ZeErrors.ERR_AUTH_FORBIDDEN_ERROR, {
        message: 'Unauthorized request',
      });
    }

    const message = redactResponse(url, options, data, resText, startTime);

    if (message === 'Not Implemented') {
      throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: 'Not implemented yet. Please get in contact with our support.',
      });
    }

    if (response.status === undefined) {
      throw new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
        content: 'No status code found',
        method: options.method?.toUpperCase() ?? 'GET',
        url: url.toString(),
        status: -1,
      });
    }

    if (!url.pathname.includes('application/logs')) {
      ze_log(message);
    }

    // Only parses data if reply content is json
    const resData = safe_json_parse<unknown>(resText) ?? resText;

    if (response.status >= 300) {
      throw new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
        status: response.status,
        url: url.toString(),
        content: typeof resData === 'string' ? resData : JSON.stringify(resData),
        method: options.method?.toUpperCase() ?? 'GET',
      });
    }

    return [true, null, resData as T];
  } catch (error) {
    return [false, error as Error];
  }
}

/** Creates a request that returns a promise for the HTTP response */
export function makeRequest<T = void>(
  urlStr: UrlString,
  options: RequestInit = {},
  data?: string | Buffer
): Promise<HttpResponse<T>> {
  const url = parseUrl(urlStr);
  return makeHttpRequest<T>(url, options, data);
}

/** Transforms `Promise<HttpResponse<T>>` into `Promise<T>` */
export async function unwrapResponse<T>(response: Promise<HttpResponse<T>>): Promise<T> {
  const [ok, error, data] = await response;

  if (!ok) {
    throw error;
  }

  return data;
}
