import { ZeErrors, ZephyrError } from '../errors';
export async function fetchWithRetries(
  url: URL,
  options: RequestInit = {},
  retries = 3
): Promise<Response> {
  for (let retry = 0; retry < retries; retry++) {
    const response = await fetch(url, options).catch(
      (error) => ({ ok: false, error }) as const
    );

    if (response.ok) {
      return response;
    }

    // Network failure, retry until attempts are exhausted
    if ('error' in response) {
      if (
        response.error?.code === 'EPIPE' ||
        response.error?.message?.includes('network')
      ) {
        continue;
      }

      throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: 'Unknown error occurred',
        cause: response,
      });
    }

    // Retry on server failures
    if (response.status >= 500) {
      continue;
    }

    throw new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
      status: response.status,
      url: url.toString(),
      content: await response.text(),
      method: options.method?.toUpperCase() ?? 'GET',
    });
  }

  throw new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
    status: -1,
    url: url.toString(),
    content: 'Max retries reached',
    method: options.method?.toUpperCase() ?? 'GET',
  });
}
