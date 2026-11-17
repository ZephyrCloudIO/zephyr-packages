import { ZeErrors, ZephyrError } from '../errors';

export type UnreachableFailure =
  | 'server_error'
  | 'rate_limited'
  | 'timeout'
  | 'dns'
  | 'network';

const NO_RESPONSE_HINT =
  'Check your network, proxy and DNS settings, then try again later. Your configuration and credentials are not the cause.';

const HINTS: Record<UnreachableFailure, string> = {
  server_error:
    'Zephyr could not handle the request. Try again later. Your configuration and credentials are not the cause.',
  rate_limited:
    'Zephyr is limiting requests. Wait, then try again. Your configuration and credentials are not the cause.',
  dns: "Verify the hostname's DNS record and your DNS settings, then try again later. Your configuration and credentials are not the cause.",
  timeout: NO_RESPONSE_HINT,
  network: NO_RESPONSE_HINT,
};

const RATE_LIMITED = 429;
const RETRY_LATER_STATUSES = new Set([408, 425, RATE_LIMITED]);

/**
 * Statuses where the next step is to try again later: the request is fine and Zephyr
 * could not serve it. `fetchWithRetries` retries the same set, so a status that is worth
 * a retry is reported as `unreachable` when the retries run out.
 */
export function isUnreachableStatus(status: number): boolean {
  return status >= 500 || RETRY_LATER_STATUSES.has(status);
}

/** `url` must already be redacted. */
export function createUnreachableError(params: {
  method: string;
  url: string;
  failure: UnreachableFailure;
  detail: string;
  status?: number;
  content?: string;
}): ZephyrError<'ERR_ZEPHYR_UNREACHABLE'> {
  const { method, url, failure, detail, status, content } = params;

  return new ZephyrError(ZeErrors.ERR_ZEPHYR_UNREACHABLE, {
    method,
    url,
    detail,
    hint: HINTS[failure],
    data: {
      failure,
      ...(status === undefined ? {} : { status }),
      ...(content ? { response: content } : {}),
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
      failure: status === RATE_LIMITED ? 'rate_limited' : 'server_error',
      detail:
        status === RATE_LIMITED ? `HTTP ${status} (too many requests)` : `HTTP ${status}`,
      status,
      content,
    });
  }

  return new ZephyrError(ZeErrors.ERR_HTTP_ERROR, { method, url, status, content });
}
