import { ZeErrors, ZephyrError } from '../errors';

export async function fetchWithRetries(
  url: URL,
  options: RequestInit = {},
  retries = 3
): Promise<Response | undefined> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    let response: Response | undefined;

    try {
      response = await fetch(url, options);
    } catch (error: any) {
      // Network failure, retry until attempts are exhausted
      if (error?.code === 'EPIPE' || error?.message?.includes('network')) {
        continue;
      }

      throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: 'Unknown error occurred',
        cause: error,
      });
    }

    if (!response.ok) {
      throw new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
        status: response.status,
        url: url.toString(),
        content: await response.text(),
        method: options.method?.toUpperCase() ?? 'GET',
      });
    }

    return response;
  }

  throw new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
    status: -1,
    url: url.toString(),
    content: 'Max retries reached',
    method: options.method?.toUpperCase() ?? 'GET',
  });
}
