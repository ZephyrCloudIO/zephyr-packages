import { Agent, EnvHttpProxyAgent, request } from 'undici';
import { ZephyrError } from '../errors';
import { fetchWithRetries } from './fetch-with-retries';

jest.mock('undici', () => ({
  request: jest.fn(),
  Agent: jest.fn().mockImplementation((options) => ({
    close: jest.fn().mockResolvedValue(undefined),
    options,
  })),
  EnvHttpProxyAgent: jest.fn().mockImplementation((options) => ({
    close: jest.fn().mockResolvedValue(undefined),
    options,
  })),
}));

const requestMock = request as jest.MockedFunction<typeof request>;
const AgentMock = Agent as jest.MockedClass<typeof Agent>;
const EnvHttpProxyAgentMock = EnvHttpProxyAgent as jest.MockedClass<
  typeof EnvHttpProxyAgent
>;

function cleanProxyEnv() {
  delete process.env['CI'];
  delete process.env['HTTP_PROXY'];
  delete process.env['HTTPS_PROXY'];
  delete process.env['http_proxy'];
  delete process.env['https_proxy'];
  delete process.env['NO_PROXY'];
  delete process.env['no_proxy'];
}

function createUndiciResponse(
  statusCode: number,
  content: unknown,
  headers: Record<string, string | string[] | undefined> = {}
): Awaited<ReturnType<typeof request>> {
  const text = typeof content === 'string' ? content : JSON.stringify(content);

  return {
    statusCode,
    headers,
    body: {
      text: jest.fn().mockResolvedValue(text),
    },
  } as unknown as Awaited<ReturnType<typeof request>>;
}

function createNetworkError(code: string, message = code): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

describe('fetchWithRetries', () => {
  const url = new URL('https://example.com/api');
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cleanProxyEnv();
  });

  afterEach(() => {
    cleanProxyEnv();
  });

  it('returns a fetch-like response on successful request', async () => {
    requestMock.mockResolvedValueOnce(
      createUndiciResponse(200, { success: true }, { 'content-type': 'application/json' })
    );

    const result = await fetchWithRetries(url, options);

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(await result.text()).toBe(JSON.stringify({ success: true }));
    await expect(result.json()).resolves.toEqual({ success: true });
    expect(requestMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: options.body,
      })
    );
    expect(AgentMock).not.toHaveBeenCalled();
    expect(EnvHttpProxyAgentMock).not.toHaveBeenCalled();
  });

  it('converts Headers instances before making the request', async () => {
    requestMock.mockResolvedValueOnce(createUndiciResponse(200, 'success'));

    await fetchWithRetries(url, {
      headers: new Headers([
        ['Accept', 'application/json'],
        ['X-Test', 'true'],
      ]),
    });

    expect(requestMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        headers: {
          accept: 'application/json',
          'x-test': 'true',
        },
      })
    );
  });

  it('retries retryable network errors', async () => {
    requestMock
      .mockRejectedValueOnce(createNetworkError('ECONNRESET', 'socket hang up'))
      .mockResolvedValueOnce(createUndiciResponse(200, 'success'));

    const result = await fetchWithRetries(url, options, 1);

    await expect(result.text()).resolves.toBe('success');
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  it('retries 5xx responses and reuses request bodies', async () => {
    requestMock
      .mockResolvedValueOnce(createUndiciResponse(500, 'server error'))
      .mockResolvedValueOnce(createUndiciResponse(503, 'server busy'))
      .mockResolvedValueOnce(createUndiciResponse(200, 'success'));

    const result = await fetchWithRetries(url, options, 2);

    await expect(result.text()).resolves.toBe('success');
    expect(requestMock).toHaveBeenCalledTimes(3);
    expect(requestMock).toHaveBeenNthCalledWith(
      3,
      url,
      expect.objectContaining({
        body: options.body,
      })
    );
  });

  it('throws ZephyrError for client errors without retrying', async () => {
    requestMock.mockResolvedValueOnce(createUndiciResponse(404, 'Not Found'));

    await expect(fetchWithRetries(url, options)).rejects.toThrow(ZephyrError);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('throws ZephyrError after retryable network retries are exhausted', async () => {
    requestMock.mockRejectedValue(createNetworkError('ETIMEDOUT', 'connect ETIMEDOUT'));

    await expect(fetchWithRetries(url, options, 1)).rejects.toThrow(ZephyrError);
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-configured network error codes', async () => {
    requestMock.mockRejectedValueOnce(createNetworkError('ENOTFOUND', 'DNS failed'));

    await expect(fetchWithRetries(url, options)).rejects.toThrow(ZephyrError);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('uses an IPv4 dispatcher in CI', async () => {
    process.env['CI'] = 'true';
    requestMock.mockResolvedValueOnce(createUndiciResponse(200, 'success'));

    await fetchWithRetries(url, options);

    expect(AgentMock).toHaveBeenCalledWith({ connect: { family: 4 } });
    expect(requestMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        dispatcher: expect.objectContaining({
          options: { connect: { family: 4 } },
        }),
      })
    );
  });

  it('uses EnvHttpProxyAgent when proxy environment variables exist', async () => {
    process.env['HTTPS_PROXY'] = 'http://proxy.example.com:8080';
    process.env['NO_PROXY'] = 'example.com,localhost';
    requestMock.mockResolvedValueOnce(createUndiciResponse(200, 'success'));

    await fetchWithRetries(url, options);

    expect(EnvHttpProxyAgentMock).toHaveBeenCalledWith({
      httpProxy: undefined,
      httpsProxy: 'http://proxy.example.com:8080',
      noProxy: 'example.com,localhost',
      connect: undefined,
    });
  });

  it('preserves uppercase proxy precedence', async () => {
    process.env['HTTPS_PROXY'] = 'http://uppercase-proxy.example.com:8080';
    process.env['https_proxy'] = 'http://lowercase-proxy.example.com:8080';
    requestMock.mockResolvedValueOnce(createUndiciResponse(200, 'success'));

    await fetchWithRetries(url, options);

    expect(EnvHttpProxyAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        httpsProxy:
          process.platform === 'win32'
            ? 'http://lowercase-proxy.example.com:8080'
            : 'http://uppercase-proxy.example.com:8080',
      })
    );
  });

  it('falls back to HTTP_PROXY for HTTPS requests through EnvHttpProxyAgent', async () => {
    process.env['HTTP_PROXY'] = 'http://http-proxy.example.com:8080';
    requestMock.mockResolvedValueOnce(createUndiciResponse(200, 'success'));

    await fetchWithRetries(url, options);

    expect(EnvHttpProxyAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        httpProxy: 'http://http-proxy.example.com:8080',
        httpsProxy: undefined,
      })
    );
  });
});
