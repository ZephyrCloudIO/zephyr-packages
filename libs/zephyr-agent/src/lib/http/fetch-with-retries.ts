import { ZeErrors, ZephyrError } from '../errors';
import type { AxiosError, AxiosRequestConfig } from 'axios';
import axios from 'axios';
import axiosRetry from 'axios-retry';

export async function fetchWithRetries(
  url: URL,
  options: RequestInit = {},
  retries = 3
): Promise<Response> {
  try {
    // Create a custom axios instance for this request
    const axiosInstance = axios.create();

    // Configure axios-retry
    axiosRetry(axiosInstance, {
      retries,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        // Retry on network errors
        if (!error.response) {
          const networkError = error.code || error.message || '';
          return networkError === 'EPIPE' || networkError.includes('network');
        }

        // Retry on server errors (5xx)
        return error.response.status >= 500;
      },
    });

    // Convert fetch options to axios options
    const axiosConfig: AxiosRequestConfig = {
      method: (options.method as any) || 'GET',
      headers: options.headers as any,
      data: options.body,
      // Only set signal if it exists to avoid null issues
      ...(options.signal ? { signal: options.signal as any } : {}),
    };

    // Make the request with retries
    const response = await axiosInstance(url.toString(), axiosConfig);

    // Convert axios response to fetch Response interface
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      headers: new Headers(response.headers as any),
      text: async () =>
        typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data) || '',
      json: async () => response.data,
    } as Response;
  } catch (error: any) {
    // Handle errors after all retries have been exhausted
    if (error.response) {
      // Client errors (4xx)
      throw new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
        status: error.response.status,
        url: url.toString(),
        content: error.response.data,
        method: options.method?.toUpperCase() ?? 'GET',
      });
    }

    // Unknown errors
    if (error.code === 'EPIPE' || (error.message && error.message.includes('network'))) {
      // Max retries reached for network error
      throw new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
        status: -1,
        url: url.toString(),
        content: 'Max retries reached for network error',
        method: options.method?.toUpperCase() ?? 'GET',
      });
    }

    // Other unknown errors
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: 'Unknown error occurred',
      cause: error,
    });
  }
}
