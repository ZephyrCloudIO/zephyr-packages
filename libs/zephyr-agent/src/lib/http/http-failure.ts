import { ZeErrors, ZephyrError } from '../errors';

/** Why Zephyr counts as unreachable. Stored in the error `data` as `failure`. */
export type UnreachableFailure = 'server_error' | 'timeout' | 'dns' | 'network';

const NO_RESPONSE_HINT =
  'Check your network, proxy and DNS settings, then try again later. Your configuration and credentials are not the cause.';
const DNS_HINT =
  "Verify the hostname's DNS record and your DNS settings, then try again later. Your configuration and credentials are not the cause.";
const SERVER_ERROR_HINT =
  'Zephyr answered with a server error. Try again later. Your configuration and credentials are not the cause.';

/**
 * HTTP statuses that mean Zephyr failed or was too slow to answer, not that the request
 * is wrong.
 */
export function isUnreachableStatus(status: number): boolean {
  return status >= 500 || status === 408;
}

/**
 * Build the `unreachable` error (ZE50001): a network error, DNS failure, timeout or HTTP
 * 5xx.
 *
 * `url` must already be redacted. `detail` is one short fact, such as `HTTP 503`.
 */
export function createUnreachableError(params: {
  method: string;
  url: string;
  failure: UnreachableFailure;
  detail: string;
  status?: number;
  content?: unknown;
}): ZephyrError<'ERR_ZEPHYR_UNREACHABLE'> {
  const { method, url, failure, detail, status, content } = params;

  return new ZephyrError(ZeErrors.ERR_ZEPHYR_UNREACHABLE, {
    method,
    url,
    detail,
    hint: {
      server_error: SERVER_ERROR_HINT,
      dns: DNS_HINT,
      timeout: NO_RESPONSE_HINT,
      network: NO_RESPONSE_HINT,
    }[failure],
    data: {
      failure,
      ...(status === undefined ? {} : { status }),
      ...(content === undefined || content === '' ? {} : { response: content }),
    },
  });
}

/**
 * Error for a response Zephyr returned. 5xx and 408 are `unreachable` (ZE50001); every
 * other status keeps the stable `ERR_HTTP_ERROR` (ZE40035) and never mentions the
 * network.
 *
 * `url` and `content` must already be redacted.
 */
export function createHttpResponseError(params: {
  method: string;
  url: string;
  status: number;
  content: string;
}): ZephyrError<'ERR_ZEPHYR_UNREACHABLE' | 'ERR_HTTP_ERROR'> {
  const { method, url, status, content } = params;

  if (isUnreachableStatus(status)) {
    return createUnreachableError({
      method,
      url,
      failure: 'server_error',
      detail: `HTTP ${status}`,
      status,
      content,
    });
  }

  return new ZephyrError(ZeErrors.ERR_HTTP_ERROR, { method, url, status, content });
}
