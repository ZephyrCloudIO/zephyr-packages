import { rs } from '@rstest/core';
import '../errors';
import * as fetchWithRetriesModule from './fetch-with-retries';
import { makeHttpRequest, makeRequest, parseUrl } from './http-request';
import { ze_log } from '../logging/debug';
import * as tokenModule from '../node-persist/token';

const jest = rs;

const mockFetchWithRetries = jest.spyOn(
  fetchWithRetriesModule,
  'fetchWithRetries'
);
const mockCleanTokens = jest.spyOn(tokenModule, 'cleanTokens');
const mockLogHttp = jest.spyOn(ze_log, 'http');

describe('Pure HTTP Request Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCleanTokens.mockResolvedValue(undefined);
    mockLogHttp.mockImplementation(() => undefined);
  });

  describe('parseUrl', () => {
    it('should parse string URLs', () => {
      const url = parseUrl('https://api.example.com/endpoint');

      expect(url.host).toBe('api.example.com');
      expect(url.pathname).toBe('/endpoint');
    });

    it('should use URL objects directly', () => {
      const originalUrl = new URL('https://api.example.com/endpoint');
      const url = parseUrl(originalUrl);

      expect(url).toBe(originalUrl);
    });

    it('should build URLs from path, base and query', () => {
      const url = parseUrl({
        path: '/api/v1/endpoint',
        base: 'https://api.example.com',
        query: { param1: 'value1', param2: true, param3: 123 },
      });

      expect(url.host).toBe('api.example.com');
      expect(url.pathname).toBe('/api/v1/endpoint');
      expect(url.searchParams.get('param1')).toBe('value1');
      expect(url.searchParams.get('param2')).toBe('true');
      expect(url.searchParams.get('param3')).toBe('123');
    });
  });

  describe('makeHttpRequest', () => {
    it('should handle successful JSON responses', async () => {
      mockFetchWithRetries.mockResolvedValueOnce({
        status: 200,
        text: async () => JSON.stringify({ success: true, data: { id: 123 } }),
        ok: true,
      } as Response);

      const url = new URL('https://api.example.com/endpoint');
      const [ok, error, data] = await makeHttpRequest<{
        success: boolean;
        data: { id: number };
      }>(url);

      expect(ok).toBe(true);
      expect(error).toBeNull();
      expect(data).toEqual({ success: true, data: { id: 123 } });
    });

    it('should handle 401 Unauthorized responses', async () => {
      mockFetchWithRetries.mockResolvedValueOnce({
        status: 401,
        text: async () => 'Unauthorized',
        ok: false,
      } as Response);

      const url = new URL('https://api.example.com/endpoint');
      const [ok, error] = await makeHttpRequest(url);

      expect(ok).toBe(false);
      expect(error).toBeInstanceOf(Error);
      expect(mockCleanTokens).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      mockFetchWithRetries.mockRejectedValueOnce(new Error('Network error'));

      const url = new URL('https://api.example.com/endpoint');
      const [ok, error] = await makeHttpRequest(url);

      expect(ok).toBe(false);
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('Network error');
    });
  });

  describe('makeRequest', () => {
    it('should call makeHttpRequest with the parsed URL', async () => {
      mockFetchWithRetries.mockResolvedValueOnce({
        status: 200,
        text: async () => JSON.stringify({ success: true }),
        ok: true,
      } as Response);

      const [ok, error, data] = await makeRequest<{ success: boolean }>(
        'https://api.example.com/endpoint'
      );

      expect(ok).toBe(true);
      expect(error).toBeNull();
      expect(data).toEqual({ success: true });
      expect(mockFetchWithRetries).toHaveBeenCalledWith(
        expect.objectContaining({
          href: 'https://api.example.com/endpoint',
          host: 'api.example.com',
        }),
        expect.any(Object)
      );
    });
  });
});
