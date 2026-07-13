import { beforeEach, describe, expect, it, rs } from '@rstest/core';
// Error types are used by mocks
import '../errors';
import { makeHttpRequest, makeRequest, parseUrl } from './http-request';

const mocks = rs.hoisted(() => ({
  fetchWithRetries: rs.fn(),
  cleanTokens: rs.fn(),
  httpLog: rs.fn(),
}));

rs.mock('./fetch-with-retries', () => ({
  fetchWithRetries: mocks.fetchWithRetries,
}));
rs.mock('../node-persist/token', () => ({ cleanTokens: mocks.cleanTokens }));
rs.mock('../logging/debug', () => ({
  ze_log: {
    http: mocks.httpLog,
  },
}));
rs.mock('../logging', () => ({ ze_log: { error: rs.fn() } }));
rs.mock('../logging/ze-log-event', () => ({ logFn: rs.fn() }));
rs.mock('zephyr-edge-contract', () => ({
  safe_json_parse: rs.fn((str) => {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }),
  formatString: rs.fn((message: string, values: Record<string, unknown>) =>
    message.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match: string, key: string) =>
      String(values[key])
    )
  ),
  stripAnsi: rs.fn((value: string) => value),
  ZE_API_ENDPOINT_HOST: rs.fn(() => 'api.zephyr.com'),
  ZE_IS_PREVIEW: rs.fn(() => false),
  ZEPHYR_API_ENDPOINT: rs.fn(() => 'https://api.zephyr.com'),
}));

describe('Pure HTTP Request Functions', () => {
  const mockFetchWithRetries = mocks.fetchWithRetries;
  const mockCleanTokens = mocks.cleanTokens;

  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('parseUrl', () => {
    it('should parse string URLs', () => {
      const url = parseUrl('https://api.example.com/endpoint');

      expect(url.href).toBe('https://api.example.com/endpoint');
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

      expect(url.href).toBe(
        'https://api.example.com/api/v1/endpoint?param1=value1&param2=true&param3=123'
      );
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

    it('recognizes the Not Implemented response body', async () => {
      mockFetchWithRetries.mockResolvedValueOnce({
        status: 200,
        text: async () => ' Not Implemented\n',
        ok: true,
      } as Response);

      const [ok, error] = await makeHttpRequest(
        new URL('https://api.example.com/endpoint')
      );

      expect(ok).toBe(false);
      expect(error?.message).toContain('Not implemented yet');
    });

    it('does not fail a successful request when log metadata is circular', async () => {
      mockFetchWithRetries.mockResolvedValueOnce({
        status: 200,
        text: async () => JSON.stringify({ success: true }),
        ok: true,
      } as Response);
      const options: RequestInit & { circular?: unknown } = {};
      options.circular = options;

      const [ok, error, data] = await makeHttpRequest<{ success: boolean }>(
        new URL('https://api.example.com/endpoint'),
        options
      );

      expect(ok).toBe(true);
      expect(error).toBeNull();
      expect(data).toEqual({ success: true });
    });

    it('redacts URL, response, and header secrets in HTTP debug output', async () => {
      const signature = 'raw-http-signature';
      const token = 'raw-http-token';
      mockFetchWithRetries.mockResolvedValueOnce({
        status: 200,
        text: async () => JSON.stringify({ access_token: token }),
        ok: true,
      } as Response);
      const url = new URL(`https://uploads.example/file?X-Amz-Signature=${signature}`);

      await makeHttpRequest(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const message = mocks.httpLog.mock.calls[0]?.[0] as string;
      expect(message).toContain('uploads.example/file');
      expect(message).not.toContain(signature);
      expect(message).not.toContain(token);
    });

    it('does not retain raw query or response secrets in HTTP errors', async () => {
      const signature = 'raw-error-signature';
      const state = 'raw-error-state';
      mockFetchWithRetries.mockResolvedValueOnce({
        status: 500,
        text: async () => JSON.stringify({ state }),
        ok: false,
      } as Response);

      const [ok, error] = await makeHttpRequest(
        new URL(`https://api.example/fail?X-Amz-Signature=${signature}`)
      );
      const serialized = JSON.stringify(error);

      expect(ok).toBe(false);
      expect(serialized).toContain('api.example/fail');
      expect(serialized).not.toContain(signature);
      expect(serialized).not.toContain(state);
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
        expect.any(Object),
        3,
        undefined
      );
    });
  });
});
