import axios from 'axios';
import axiosRetry from 'axios-retry';
import { ZephyrError } from '../errors';
import { fetchWithRetries } from './fetch-with-retries';

// Mock axios, axios-retry, isCI, and proxy agents
jest.mock('axios');
jest.mock('axios-retry');
jest.mock('is-ci', () => false); // Default to non-CI

// Mock HTTPS proxy agent class - define mock function inside factory to avoid hoisting issues
jest.mock('https-proxy-agent', () => ({
  HttpsProxyAgent: jest
    .fn()
    .mockImplementation((url) => ({ proxyUrl: url, type: 'https' })),
}));

// Import mocked module to access mock function
import { HttpsProxyAgent } from 'https-proxy-agent';

const MockHttpsProxyAgent = HttpsProxyAgent as jest.MockedClass<typeof HttpsProxyAgent>;

// Setup mocks
const mockCreate = jest.fn();
axios.create = mockCreate;

const mockAxiosInstance = jest.fn();
mockCreate.mockReturnValue(mockAxiosInstance);

// Helper to clean proxy environment variables
const cleanProxyEnv = () => {
  delete process.env['HTTP_PROXY'];
  delete process.env['HTTPS_PROXY'];
  delete process.env['http_proxy'];
  delete process.env['https_proxy'];
  delete process.env['NO_PROXY'];
  delete process.env['no_proxy'];
};

describe('fetchWithRetries', () => {
  const url = new URL('https://example.com/api');
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' } };

  beforeEach(() => {
    jest.clearAllMocks();
    cleanProxyEnv();
  });

  afterEach(() => {
    cleanProxyEnv();
  });

  it('should return response on successful request', async () => {
    const mockAxiosResponse = {
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { success: true },
    };

    mockAxiosInstance.mockResolvedValueOnce(mockAxiosResponse);

    const result = await fetchWithRetries(url, options);

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(typeof result.text).toBe('function');

    // Verify axios create was called with default settings (non-CI, no proxy)
    expect(axios.create).toHaveBeenCalledWith({
      family: undefined,
      httpsAgent: undefined,
    });

    // Verify axios-retry was configured
    expect(axiosRetry).toHaveBeenCalledWith(
      mockAxiosInstance,
      expect.objectContaining({
        retries: 3,
        retryDelay: axiosRetry.exponentialDelay,
        retryCondition: expect.any(Function),
      })
    );

    // Verify axios instance was called with correct params
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      url.toString(),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should configure retryCondition for network errors', async () => {
    const mockResponse = {
      status: 200,
      headers: {},
      data: 'success',
    };

    mockAxiosInstance.mockResolvedValueOnce(mockResponse);

    await fetchWithRetries(url, options);

    // Get retry condition function
    const retryConfigArg = (axiosRetry as unknown as jest.Mock).mock.calls[0][1];
    const retryCondition = retryConfigArg.retryCondition;

    // Test retry condition with network error (message-based)
    const networkError = {
      code: undefined, // no error code
      message: 'network error',
      isAxiosError: true,
    };
    expect(retryCondition(networkError)).toBe(true);

    // Test retry condition with EPIPE error
    const epipeError = {
      code: 'EPIPE',
      message: 'write EPIPE',
      isAxiosError: true,
    };
    expect(retryCondition(epipeError)).toBe(true);

    // Test retry condition with ETIMEDOUT error
    const etimedoutError = {
      code: 'ETIMEDOUT',
      message: 'connect ETIMEDOUT',
      isAxiosError: true,
    };
    expect(retryCondition(etimedoutError)).toBe(true);

    // Test retry condition with ENETUNREACH error
    const enetunreachError = {
      code: 'ENETUNREACH',
      message: 'connect ENETUNREACH',
      isAxiosError: true,
    };
    expect(retryCondition(enetunreachError)).toBe(true);

    // Test retry condition with ECONNRESET error
    const econnresetError = {
      code: 'ECONNRESET',
      message: 'socket hang up',
      isAxiosError: true,
    };
    expect(retryCondition(econnresetError)).toBe(true);

    // Test retry condition with ECONNREFUSED error
    const econnrefusedError = {
      code: 'ECONNREFUSED',
      message: 'connect ECONNREFUSED',
      isAxiosError: true,
    };
    expect(retryCondition(econnrefusedError)).toBe(true);

    // Test retry condition with 500 error
    const serverError = {
      response: {
        status: 503,
      },
      isAxiosError: true,
    };
    expect(retryCondition(serverError)).toBe(true);

    // Test retry condition with 400 error (shouldn't retry)
    const clientError = {
      response: {
        status: 404,
      },
      isAxiosError: true,
    };
    expect(retryCondition(clientError)).toBe(false);
  });

  it('should handle client error after retries exhausted', async () => {
    const clientError = {
      response: {
        status: 404,
        data: 'Not Found',
        headers: {},
      },
      isAxiosError: true,
    };

    mockAxiosInstance.mockRejectedValueOnce(clientError);

    await expect(fetchWithRetries(url, options)).rejects.toThrow(ZephyrError);
    expect(mockAxiosInstance).toHaveBeenCalledTimes(1);
  });

  it('should handle network error after retries exhausted', async () => {
    const networkError = {
      message: 'network error',
      isAxiosError: true,
    };

    mockAxiosInstance.mockRejectedValueOnce(networkError);

    await expect(fetchWithRetries(url, options)).rejects.toThrow(ZephyrError);
    expect(mockAxiosInstance).toHaveBeenCalledTimes(1);
  });

  it('should handle unknown errors', async () => {
    const unknownError = {
      message: 'Unknown error',
      isAxiosError: true,
    };

    mockAxiosInstance.mockRejectedValueOnce(unknownError);

    await expect(fetchWithRetries(url, options)).rejects.toThrow(ZephyrError);
    expect(mockAxiosInstance).toHaveBeenCalledTimes(1);
  });

  it('should use default options when not provided', async () => {
    mockAxiosInstance.mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: 'success',
    });

    await fetchWithRetries(url);

    expect(mockAxiosInstance).toHaveBeenCalledWith(
      url.toString(),
      expect.objectContaining({
        method: 'GET',
      })
    );
  });

  it('should respect custom retry count', async () => {
    const customRetries = 5;
    mockAxiosInstance.mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: 'success',
    });

    await fetchWithRetries(url, options, customRetries);

    expect(axiosRetry).toHaveBeenCalledWith(
      mockAxiosInstance,
      expect.objectContaining({
        retries: customRetries,
      })
    );
  });

  it('should use undefined family in non-CI environment (default)', async () => {
    // This test verifies the default behavior when isCI is false
    // Note: CI behavior (family: 4) is tested in integration tests since
    // isCI is determined at module load time and difficult to mock dynamically
    mockAxiosInstance.mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: 'success',
    });

    await fetchWithRetries(url, options);

    expect(axios.create).toHaveBeenCalledWith({
      family: undefined, // Default behavior (both IPv4 and IPv6)
      httpsAgent: undefined,
    });
  });

  it('should not retry on error without code', async () => {
    mockAxiosInstance.mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: 'success',
    });

    await fetchWithRetries(url, options);

    const retryConfigArg = (axiosRetry as unknown as jest.Mock).mock.calls[0][1];
    const retryCondition = retryConfigArg.retryCondition;

    // Error without code should not retry
    const errorWithoutCode = {
      message: 'some error',
      isAxiosError: true,
    };
    expect(retryCondition(errorWithoutCode)).toBe(false);
  });

  it('should not retry on non-network error codes', async () => {
    mockAxiosInstance.mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: 'success',
    });

    await fetchWithRetries(url, options);

    const retryConfigArg = (axiosRetry as unknown as jest.Mock).mock.calls[0][1];
    const retryCondition = retryConfigArg.retryCondition;

    // Non-network error should not retry
    const nonNetworkError = {
      code: 'ENOTFOUND',
      message: 'DNS resolution failed',
      isAxiosError: true,
    };
    expect(retryCondition(nonNetworkError)).toBe(false);
  });

  describe('proxy support', () => {
    it('should use HTTPS_PROXY environment variable for https requests', async () => {
      process.env['HTTPS_PROXY'] = 'http://proxy.example.com:8080';

      mockAxiosInstance.mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: 'success',
      });

      await fetchWithRetries(url, options);

      expect(MockHttpsProxyAgent).toHaveBeenCalledWith('http://proxy.example.com:8080');
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          httpsAgent: expect.objectContaining({
            proxyUrl: 'http://proxy.example.com:8080',
          }),
        })
      );
    });

    it('should use lowercase https_proxy environment variable', async () => {
      process.env['https_proxy'] = 'http://lowercase-proxy.example.com:8080';

      mockAxiosInstance.mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: 'success',
      });

      await fetchWithRetries(url, options);

      expect(MockHttpsProxyAgent).toHaveBeenCalledWith(
        'http://lowercase-proxy.example.com:8080'
      );
    });

    it('should prefer HTTPS_PROXY over https_proxy', async () => {
      process.env['HTTPS_PROXY'] = 'http://uppercase-proxy.example.com:8080';
      process.env['https_proxy'] = 'http://lowercase-proxy.example.com:8080';

      mockAxiosInstance.mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: 'success',
      });

      await fetchWithRetries(url, options);

      // On Windows, environment variables are case-insensitive, so the last set value wins
      // On Unix/macOS, HTTPS_PROXY takes precedence per the implementation order
      const expectedProxy =
        process.platform === 'win32'
          ? 'http://lowercase-proxy.example.com:8080'
          : 'http://uppercase-proxy.example.com:8080';

      expect(MockHttpsProxyAgent).toHaveBeenCalledWith(expectedProxy);
    });

    it('should fallback to HTTP_PROXY for https requests if HTTPS_PROXY is not set', async () => {
      process.env['HTTP_PROXY'] = 'http://http-proxy.example.com:8080';

      mockAxiosInstance.mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: 'success',
      });

      await fetchWithRetries(url, options);

      expect(MockHttpsProxyAgent).toHaveBeenCalledWith(
        'http://http-proxy.example.com:8080'
      );
    });

    it('should bypass proxy for hosts in NO_PROXY', async () => {
      process.env['HTTPS_PROXY'] = 'http://proxy.example.com:8080';
      process.env['NO_PROXY'] = 'example.com,localhost';

      mockAxiosInstance.mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: 'success',
      });

      await fetchWithRetries(url, options);

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          httpsAgent: undefined,
        })
      );
    });

    it('should bypass proxy for hosts in lowercase no_proxy', async () => {
      process.env['HTTPS_PROXY'] = 'http://proxy.example.com:8080';
      process.env['no_proxy'] = 'example.com';

      mockAxiosInstance.mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: 'success',
      });

      await fetchWithRetries(url, options);

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          httpsAgent: undefined,
        })
      );
    });

    it('should bypass proxy when NO_PROXY is wildcard *', async () => {
      process.env['HTTPS_PROXY'] = 'http://proxy.example.com:8080';
      process.env['NO_PROXY'] = '*';

      mockAxiosInstance.mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: 'success',
      });

      await fetchWithRetries(url, options);

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          httpsAgent: undefined,
        })
      );
    });

    it('should bypass proxy for subdomains when NO_PROXY uses dot prefix', async () => {
      const subdomainUrl = new URL('https://api.example.com/resource');
      process.env['HTTPS_PROXY'] = 'http://proxy.example.com:8080';
      process.env['NO_PROXY'] = '.example.com';

      mockAxiosInstance.mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: 'success',
      });

      await fetchWithRetries(subdomainUrl, options);

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          httpsAgent: undefined,
        })
      );
    });

    it('should bypass proxy for exact domain match with dot prefix in NO_PROXY', async () => {
      process.env['HTTPS_PROXY'] = 'http://proxy.example.com:8080';
      process.env['NO_PROXY'] = '.example.com';

      mockAxiosInstance.mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: 'success',
      });

      await fetchWithRetries(url, options);

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          httpsAgent: undefined,
        })
      );
    });

    it('should not bypass proxy for unmatched hosts in NO_PROXY', async () => {
      process.env['HTTPS_PROXY'] = 'http://proxy.example.com:8080';
      process.env['NO_PROXY'] = 'other.com,localhost';

      mockAxiosInstance.mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: 'success',
      });

      await fetchWithRetries(url, options);

      expect(MockHttpsProxyAgent).toHaveBeenCalledWith('http://proxy.example.com:8080');
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          httpsAgent: expect.objectContaining({
            proxyUrl: 'http://proxy.example.com:8080',
          }),
        })
      );
    });

    it('should handle case-insensitive NO_PROXY matching', async () => {
      process.env['HTTPS_PROXY'] = 'http://proxy.example.com:8080';
      process.env['NO_PROXY'] = 'EXAMPLE.COM';

      mockAxiosInstance.mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: 'success',
      });

      await fetchWithRetries(url, options);

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          httpsAgent: undefined,
        })
      );
    });

    it('should not create proxy agents when no proxy env vars are set', async () => {
      mockAxiosInstance.mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: 'success',
      });

      await fetchWithRetries(url, options);

      expect(MockHttpsProxyAgent).not.toHaveBeenCalled();
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          httpsAgent: undefined,
        })
      );
    });

    it('should not initialize HttpsProxyAgent constructor when no proxy environment variables are present', async () => {
      // Ensure all proxy env vars are cleared
      expect(process.env['HTTP_PROXY']).toBeUndefined();
      expect(process.env['HTTPS_PROXY']).toBeUndefined();
      expect(process.env['http_proxy']).toBeUndefined();
      expect(process.env['https_proxy']).toBeUndefined();

      // Mock responses for both requests
      mockAxiosInstance
        .mockResolvedValueOnce({
          status: 200,
          headers: {},
          data: 'success',
        })
        .mockResolvedValueOnce({
          status: 200,
          headers: {},
          data: 'success',
        });

      // Make both HTTP and HTTPS requests
      const httpUrl = new URL('http://example.com/api');
      const httpsUrl = new URL('https://example.com/api');

      await fetchWithRetries(httpUrl, options);
      await fetchWithRetries(httpsUrl, options);

      // Verify proxy agent constructor was never invoked
      expect(MockHttpsProxyAgent).toHaveBeenCalledTimes(0);
    });
  });
});
