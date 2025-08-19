import type { AxiosRequestConfig } from 'axios';
import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import isCI from 'is-ci';
import { ZeErrors, ZephyrError } from '../errors';

export async function fetchWithRetries(
  url: URL,
  options: RequestInit = {},
  retries = 3
): Promise<Response> {
  try {
    // Create a custom axios instance for this request with CI-friendly settings
    const axiosInstance = axios.create({
      // Force IPv4 in CI environments or when explicitly requested to avoid IPv6 connectivity issues
      family: isCI ? 4 : undefined,
    });

    // Configure axios-retry
    axiosRetry(axiosInstance, {
      retries,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        // Retry on network errors (no response received)
        if (!error.response) {
          const errorCode = error.code;
          const errorMessage = error.message || '';

          // Retry on connection timeouts, network unreachable, and other network errors
          const shouldRetry = !!(
            errorCode &&
            (errorCode === 'ETIMEDOUT' ||
              errorCode === 'ENETUNREACH' ||
              errorCode === 'ECONNRESET' ||
              errorCode === 'ECONNREFUSED' ||
              errorCode === 'EPIPE' ||
              errorMessage.includes('network') ||
              errorMessage.includes('timeout'))
          );

          return shouldRetry;
        }

        // Retry on server errors (5xx)
        return error.response.status >= 500;
      },
    });

    // Convert fetch options to axios options
    const axiosConfig: AxiosRequestConfig = {
      method: options.method ?? 'GET',
      data: options.body,
      // Only set signal if it exists to avoid null issues
      ...(options.signal ? { signal: options.signal } : {}),
    };

    if (options.headers) {
      // Convert HeadersInit to a format compatible with axios headers
      if (options.headers instanceof Headers) {
        // Convert Headers object to record
        const headersRecord: Record<string, string> = {};
        options.headers.forEach((value, key) => {
          headersRecord[key] = value;
        });
        axiosConfig.headers = headersRecord;
      } else if (Array.isArray(options.headers)) {
        // Convert header entries array to record
        const headersRecord: Record<string, string> = {};
        options.headers.forEach(([key, value]) => {
          headersRecord[key] = value;
        });
        axiosConfig.headers = headersRecord;
      } else {
        // Already a record object
        axiosConfig.headers = options.headers;
      }
    }

    // Make the request with retries
    const response = await axiosInstance(url.toString(), axiosConfig);

    // Convert axios response to fetch Response interface
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      headers: new Headers(
        Object.entries(response.headers).reduce(
          (acc, [key, value]) => {
            if (value !== undefined) {
              acc[key] = typeof value === 'string' ? value : String(value);
            }
            return acc;
          },
          {} as Record<string, string>
        )
      ),
      text: async () =>
        typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data) || '',
      json: async () => response.data,
    } as Response;
  } catch (error) {
    // Handle errors after all retries have been exhausted
    if (error instanceof AxiosError && error.response) {
      // Client errors (4xx)
      throw new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
        status: error.response.status,
        url: url.toString(),
        content: error.response.data,
        method: options.method?.toUpperCase() ?? 'GET',
      });
    }

    // Unknown errors
    if (
      error instanceof AxiosError &&
      (error.code === 'EPIPE' || (error.message && error.message.includes('network')))
    ) {
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
