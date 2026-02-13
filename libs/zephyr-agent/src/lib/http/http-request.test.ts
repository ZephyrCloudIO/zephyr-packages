// Error types are used by mocks
import '../errors';
import { cleanTokens } from '../node-persist/token';
import { fetchWithRetries } from './fetch-with-retries';
import { makeHttpRequest, makeRequest, parseUrl } from './http-request';

const mockInjectTraceHeaders = jest.fn((headers?: HeadersInit) => ({
  ...(headers as Record<string, string> | undefined),
  traceparent: '00-test-trace',
}));
const mockWithTelemetrySpan = jest.fn(async (_name, work) => work(undefined));

// Mock dependencies
jest.mock('./fetch-with-retries');
jest.mock('../node-persist/token');
jest.mock('../telemetry', () => ({
  injectTraceHeaders: (headers?: HeadersInit) => mockInjectTraceHeaders(headers),
  withTelemetrySpan: (
    name: string,
    work: unknown,
    attributes?: unknown,
    kind?: unknown
  ) => mockWithTelemetrySpan(name, work, attributes, kind),
}));
jest.mock('../logging/debug', () => ({
  ze_log: {
    http: jest.fn(),
  },
}));
jest.mock('zephyr-edge-contract', () => ({
  PromiseWithResolvers: () => {
    let resolve: (value: unknown) => void = () => undefined;
    let reject: (reason?: unknown) => void = () => undefined;
    const promise = new Promise<unknown>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return { promise, resolve, reject };
  },
  safe_json_parse: jest.fn((str) => {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }),
  ZE_API_ENDPOINT_HOST: jest.fn(() => 'api.zephyr.com'),
  ZE_IS_PREVIEW: jest.fn(() => false),
  ZEPHYR_API_ENDPOINT: jest.fn(() => 'https://api.zephyr.com'),
}));

describe('Pure HTTP Request Functions', () => {
  const mockFetchWithRetries = fetchWithRetries as jest.MockedFunction<
    typeof fetchWithRetries
  >;
  const mockCleanTokens = cleanTokens as jest.MockedFunction<typeof cleanTokens>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInjectTraceHeaders.mockClear();
    mockWithTelemetrySpan.mockClear();
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
      expect(mockWithTelemetrySpan).toHaveBeenCalledTimes(1);
      expect(mockInjectTraceHeaders).toHaveBeenCalledTimes(1);
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
      expect(mockWithTelemetrySpan).toHaveBeenCalledTimes(1);
      expect(mockInjectTraceHeaders).toHaveBeenCalledTimes(1);
      expect(mockFetchWithRetries).toHaveBeenCalledWith(
        expect.objectContaining({
          href: 'https://api.example.com/endpoint',
          host: 'api.example.com',
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            traceparent: '00-test-trace',
          }),
        })
      );
    });
  });
});
