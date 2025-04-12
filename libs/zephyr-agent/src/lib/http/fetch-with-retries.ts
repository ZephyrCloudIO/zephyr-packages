import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging/debug';

export async function fetchWithRetries(
  url: URL,
  options: RequestInit = {},
  retries = 3
): Promise<Response | undefined> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
          status: response.status,
          url: url.toString(),
          content: await response.text(),
          method: options.method?.toUpperCase() ?? 'GET',
        });
      }
      return response;
    } catch (err) {
      const error = err as any;
      if (attempt === retries) {
        ze_log('Max retries reached. Request failed:', error.message);
        throw err;
      }
      if (error.code === 'EPIPE' || error.message.includes('network')) {
        ze_log(`Attempt ${attempt} failed due to network issue, retrying...`);
      } else {
        ze_log(`Attempt ${attempt} failed with error:`, error.message);
        throw error;
      }
    }
  }

  throw new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
    status: -1,
    url: url.toString(),
    content: 'Max retries reached',
    method: options.method?.toUpperCase() ?? 'GET',
  });
}
