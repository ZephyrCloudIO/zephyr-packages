import type { AxiosRequestConfig } from 'axios';
import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import isCI from 'is-ci';
import { ZeErrors, ZephyrError } from '../errors';

const IPV4_FAMILY = 4;
const RETRY_ERROR_CODES = [
  'ETIMEDOUT',
  'ENETUNREACH',
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
];

/**
 * Gets proxy URL from environment variables.
 * Checks both uppercase and lowercase variants.
 * Returns undefined if no proxy is configured.
 */
function getProxyUrl(protocol: 'http' | 'https'): string | undefined {
  const envVars =
    protocol === 'https'
      ? ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy']
      : ['HTTP_PROXY', 'http_proxy'];

  for (const envVar of envVars) {
    const value = process.env[envVar];
    if (value) {
      return value;
    }
  }
  return undefined;
}

/**
 * Checks if a host should bypass the proxy based on NO_PROXY environment variable.
 * NO_PROXY is a comma-separated list of hosts that should not use the proxy.
 */
function shouldBypassProxy(hostname: string): boolean {
  const noProxy = process.env['NO_PROXY'] || process.env['no_proxy'];
  if (!noProxy) {
    return false;
  }

  const noProxyList = noProxy.split(',').map((h) => h.trim().toLowerCase());
  const hostLower = hostname.toLowerCase();

  return noProxyList.some((noProxyHost) => {
    if (noProxyHost === '*') {
      return true;
    }
    // Handle wildcard domains like .example.com
    if (noProxyHost.startsWith('.')) {
      return hostLower.endsWith(noProxyHost) || hostLower === noProxyHost.slice(1);
    }
    return hostLower === noProxyHost || hostLower.endsWith(`.${noProxyHost}`);
  });
}

/**
 * Creates HTTP/HTTPS agents with proxy support if configured via environment variables.
 */
function getProxyAgents(url: URL): {
  httpAgent?: HttpProxyAgent<string>;
  httpsAgent?: HttpsProxyAgent<string>;
} {
  // Check if this host should bypass the proxy
  if (shouldBypassProxy(url.hostname)) {
    return {};
  }

  const httpProxyUrl = getProxyUrl('http');
  const httpsProxyUrl = getProxyUrl('https');

  return {
    httpAgent: httpProxyUrl ? new HttpProxyAgent(httpProxyUrl) : undefined,
    httpsAgent: httpsProxyUrl ? new HttpsProxyAgent(httpsProxyUrl) : undefined,
  };
}

function shouldRetry(error: AxiosError): boolean {
  // Retry on network errors (no response received)
  if (!error.response) {
    const code = error.code;
    const message = error.message || '';
    return (
      (code && RETRY_ERROR_CODES.includes(code)) ||
      message.includes('network') ||
      message.includes('timeout')
    );
  }

  // Retry on server errors (5xx)
  return error.response.status >= 500;
}

export async function fetchWithRetries(
  url: URL,
  options: RequestInit = {},
  retries = 3
): Promise<Response> {
  try {
    // Get proxy agents if configured via environment variables
    const { httpAgent, httpsAgent } = getProxyAgents(url);

    // Create a custom axios instance for this request with CI-friendly settings
    const axiosInstance = axios.create({
      // Force IPv4 in CI environments to avoid IPv6 connectivity issues
      // References: https://github.com/actions/runner/issues/3138
      // https://x.com/matteocollina/status/1640384245834055680
      family: isCI ? IPV4_FAMILY : undefined,
      // Apply proxy agents if configured
      httpAgent,
      httpsAgent,
    });

    // Configure axios-retry
    axiosRetry(axiosInstance, {
      retries,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: shouldRetry,
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
