import { ZephyrError } from '../errors';
import { fetchWithRetries } from './fetch-with-retries';
import axios from 'axios';
import axiosRetry from 'axios-retry';

// Mock axios and axios-retry
jest.mock('axios');
jest.mock('axios-retry');

// Setup mocks
const mockCreate = jest.fn();
axios.create = mockCreate;

const mockAxiosInstance = jest.fn();
mockCreate.mockReturnValue(mockAxiosInstance);

describe('fetchWithRetries', () => {
  const url = new URL('https://example.com/api');
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' } };

  beforeEach(() => {
    jest.clearAllMocks();
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

    // Verify axios create was called
    expect(axios.create).toHaveBeenCalledTimes(1);

    // Verify axios-retry was configured
    expect(axiosRetry).toHaveBeenCalledWith(
      mockAxiosInstance,
      expect.objectContaining({
        retries: 3,
        retryDelay: axiosRetry.exponentialDelay,
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
    const retryConfigArg = (axiosRetry as jest.Mock).mock.calls[0][1];
    const retryCondition = retryConfigArg.retryCondition;

    // Test retry condition with network error
    const networkError = {
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
});
