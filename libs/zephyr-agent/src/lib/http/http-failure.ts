import { ZeErrors, ZephyrError } from '../errors';

export type UnreachableFailure = 'server_error' | 'timeout' | 'dns' | 'network';

const NO_RESPONSE_HINT =
  'Check your network, proxy and DNS settings, then try again later. Your configuration and credentials are not the cause.';
const DNS_HINT =
  "Verify the hostname's DNS record and your DNS settings, then try again later. Your configuration and credentials are not the cause.";
const SERVER_ERROR_HINT =
  'Zephyr answered with a server error. Try again later. Your configuration and credentials are not the cause.';

export function isUnreachableStatus(status: number): boolean {
  return status >= 500 || status === 408;
}

/** `url` must already be redacted. */
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

/** `url` and `content` must already be redacted. */
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
