import { ZeErrors, ZephyrError } from '../errors';
import { cleanTokens } from '../node-persist/token';
import { ze_log } from '../logging/debug';
import {
  PromiseWithResolvers,
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

/** Starts a new http request */
export class ZeHttpRequest<T = void> implements PromiseLike<HttpResponse<T>> {
  /** The time the request was started. */
  #start = Date.now();

  /** The URL to request. */
  #url!: URL;

  /** The options for the request. */
  #options!: RequestInit;

  /** The data to send with the request. */
  #data?: string | Buffer;

  // private methods for resolving and rejecting the promise
  #promise = PromiseWithResolvers<HttpResponse<T>>();
  // promise extension
  then = this.#promise.promise.then.bind(this.#promise.promise);

  /** Creates a new http request. */
  static from<T = void>(
    urlStr: UrlString,
    options: RequestInit = {},
    data?: string | Buffer
  ): ZeHttpRequest<T> {
    const req = new ZeHttpRequest<T>();
    req.#data = data;
    req.#options = options;

    // Parse the url into a URL object
    if (typeof urlStr === 'string') {
      req.#url = new URL(urlStr);
    } else if (urlStr instanceof URL) {
      req.#url = urlStr;
    } else {
      req.#url = new URL(urlStr.path, urlStr.base);

      for (const [key, value] of Object.entries(urlStr.query)) {
        req.#url.searchParams.append(key, String(value));
      }
    }

    const is_preview = ZE_IS_PREVIEW();
    const ze_api_endpoint_host = ZE_API_ENDPOINT_HOST();
    const zephyr_api_endpoint = ZEPHYR_API_ENDPOINT();

    // Add a query param hint in preview environments
    if (is_preview && req.#url.host === ze_api_endpoint_host) {
      req.#url.searchParams.set('api_host', zephyr_api_endpoint);
    }

    void req.#request();

    return req;
  }

  /** Transforms `Promise<HttpResponse<T>>` into `Promise<T>` */
  async unwrap() {
    const [ok, error, data] = await this;

    if (!ok) {
      throw error;
    }

    return data;
  }

  /** "Rejects" the promise with an error. */
  #reject(error: Error) {
    this.#promise.resolve([false, error]);
  }

  /** Resolves the promise with the data. */
  #resolve(data: T) {
    this.#promise.resolve([true, null, data]);
  }

  async #request() {
    try {
      const response = await fetchWithRetries(this.#url, {
        ...this.#options,
        body: this.#data,
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

      const message = this.#redact(resText);

      if (message === 'Not Implemented') {
        throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
          message: 'Not implemented yet. Please get in contact with our support.',
        });
      }

      if (response.status === undefined) {
        throw new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
          content: 'No status code found',
          method: this.#options.method?.toUpperCase() ?? 'GET',
          url: this.#url.toString(),
          status: -1,
        });
      }

      if (!this.#url.pathname.includes('application/logs')) {
        ze_log(message);
      }

      // Only parses data if reply content is json
      const resData = safe_json_parse<any>(resText) ?? resText;

      if (response.status >= 300) {
        throw new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
          status: response.status,
          url: this.#url.toString(),
          content: resData,
          method: this.#options.method?.toUpperCase() ?? 'GET',
        });
      }

      this.#resolve(resData as T);
    } catch (error) {
      this.#reject(error as Error);
    }
  }

  #redact(response: unknown): string {
    const str = [
      `[${this.#options.method || 'GET'}][${this.#url}]: ${Date.now() - this.#start}ms`,
      this.#data?.length ? ` - ${((this.#data.length ?? 0) / 1024).toFixed(2)}kb` : '',
      response ? `Response: ${response}` : '',
      this.#options ? `Options: ${JSON.stringify(this.#options)}` : '',
    ].join('\n');

    return str
      .replace(/Bearer ([^"|']+)/gi, 'Bearer [REDACTED]')
      .replace(/"?jwt"?:["|\W']{0,2}([^"|']+)(["|'])/gi, 'jwt: [REDACTED]');
  }
}
