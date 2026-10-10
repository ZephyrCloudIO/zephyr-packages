import {
  safe_json_parse,
  ZE_API_ENDPOINT_HOST,
  ZE_IS_PREVIEW,
  ZEPHYR_API_ENDPOINT,
} from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging/debug';
import { cleanTokens } from '../node-persist/token';
import { redactString, redactUrl, safeStringifyForLogging } from '../security/redaction';
import { fetchWithRetries } from './fetch-with-retries';

/** Http request wrapper that returns a tuple with the response data or an error. */
export type HttpResponse<T> =
  | [ok: true, error: null, data: T]
  | [ok: false, error: Error];

export interface HttpRequestOptions extends RequestInit {
  /** Private evidence endpoints must not echo response bodies into diagnostics. */
  sensitiveResponse?: boolean;
  /**
   * The credential this request authenticates with. A 401 invalidates only this
   * credential, so a delayed response cannot remove a newer token persisted by another
   * process. Authenticated callers should always set it alongside the `Authorization`
   * header; omitting it falls back to invalidating all stored authentication.
   */
  credentialToken?: string;
  /** Internal requests which are themselves refreshing credentials must not recurse. */
  skipTokenCleanup?: boolean;
  /** Overall deadline including retries. Defaults to the transport deadline. */
  deadlineMs?: number;
  /** Retry 408/425/429 responses. Defaults to true; 5xx retry rules are unchanged. */
  retryClientErrors?: boolean;
  /**
   * Turns a non-2xx response (other than 401 and 403, which keep their auth errors) into
   * a caller-owned error. Receives the parsed body; the returned error must not echo
   * response values.
   */
  mapErrorResponse?: (status: number, body: unknown) => Error | undefined;
}

export type UrlString =
  | string
  | URL
  | {
      path: string;
      base?: string;
      query: Record<string, string | number | boolean>;
    };

function applyApiHost(url: URL): URL {
  // Add a query param hint in preview environments
  const is_preview = ZE_IS_PREVIEW();
  const ze_api_endpoint_host = ZE_API_ENDPOINT_HOST();
  const zephyr_api_endpoint = ZEPHYR_API_ENDPOINT();

  if (is_preview && url.host === ze_api_endpoint_host) {
    url.searchParams.set('api_host', zephyr_api_endpoint);
  }

  return url;
}

/** Parses the URL string into a URL object */
export function parseUrl(urlStr: UrlString): URL {
  if (typeof urlStr === 'string') {
    return applyApiHost(new URL(urlStr));
  } else if (urlStr instanceof URL) {
    return applyApiHost(urlStr);
  } else {
    const url = new URL(urlStr.path, urlStr.base);

    for (const [key, value] of Object.entries(urlStr.query)) {
      url.searchParams.append(key, String(value));
    }

    return applyApiHost(url);
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
  return [
    `[${options.method || 'GET'}][${redactUrl(url)}]: ${Date.now() - startTime}ms`,
    data?.length ? ` - ${((data.length ?? 0) / 1024).toFixed(2)}kb` : '',
    response !== undefined ? `Response: ${redactString(String(response))}` : '',
    `Options: ${safeStringifyForLogging(options)}`,
  ].join('\n');
}

/** Main HTTP request function that handles the request and response */
export async function makeHttpRequest<T = void>(
  url: URL,
  options: HttpRequestOptions = {},
  data?: string | Buffer
): Promise<HttpResponse<T>> {
  const startTime = Date.now();
  const {
    credentialToken,
    skipTokenCleanup = false,
    sensitiveResponse = false,
    deadlineMs,
    retryClientErrors,
    mapErrorResponse,
    ...requestOptions
  } = options;

  try {
    const fetchOptions = { ...requestOptions, body: data as BodyInit | null | undefined };
    const response = await fetchWithRetries(
      url,
      fetchOptions,
      undefined,
      deadlineMs,
      retryClientErrors
    );

    const resText = await response.text();

    if (response.status === 401) {
      const authenticationError = new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
        message: 'The request authentication is invalid or expired.',
      });

      if (!skipTokenCleanup) {
        try {
          await cleanTokens(credentialToken);
        } catch (error) {
          ze_log.error('Failed to remove rejected authentication credentials:', error);
        }
      }

      throw authenticationError;
    }

    if (response.status === 403) {
      // A caller that maps client errors (synchronous MCP build stats) also owns 403s,
      // so a gateway-passed API rejection keeps its issue paths. 401 always stays an
      // authentication error because it must clear rejected credentials.
      const mappedForbidden = mapErrorResponse?.(
        response.status,
        safe_json_parse<unknown>(resText) ?? resText
      );
      if (mappedForbidden) throw mappedForbidden;
      throw new ZephyrError(ZeErrors.ERR_AUTH_FORBIDDEN_ERROR, {
        message: 'The authenticated account does not have access to this target.',
      });
    }

    const message = redactResponse(
      url,
      requestOptions,
      data,
      sensitiveResponse ? '[private response omitted]' : resText,
      startTime
    );

    if (resText.trim() === 'Not Implemented') {
      throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: 'Not implemented yet. Please get in contact with our support.',
      });
    }

    if (!url.pathname.includes('application/logs')) {
      ze_log.http(message);
    }

    // Only parses data if reply content is json
    const resData = safe_json_parse<unknown>(resText) ?? resText;

    if (!response.status || response.status >= 300) {
      const mappedError = mapErrorResponse?.(response.status, resData);
      if (mappedError) throw mappedError;
      throw new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
        status: response.status,
        url: redactUrl(url),
        content: sensitiveResponse
          ? 'Private endpoint rejected the request; response body omitted'
          : typeof resData === 'string'
            ? redactString(resData)
            : safeStringifyForLogging(resData),
        method: requestOptions.method?.toUpperCase() ?? 'GET',
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
  options: HttpRequestOptions = {},
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
