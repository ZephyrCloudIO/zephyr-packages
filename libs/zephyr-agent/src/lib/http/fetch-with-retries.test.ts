import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { ZephyrError } from '../errors';
import { DEFAULT_HTTP_DEADLINE_MS, fetchWithRetries } from './fetch-with-retries';

const mocks = rs.hoisted(() => ({
  axiosCreate: rs.fn(),
  axiosInstance: rs.fn(),
  proxyAgent: rs.fn(function (this: { proxyUrl?: string }, url: string) {
    this.proxyUrl = url;
  }),
}));

rs.mock('axios', () => ({
  default: { create: mocks.axiosCreate },
}));
rs.mock('is-ci', () => ({ default: false }));
rs.mock('https-proxy-agent', () => ({ HttpsProxyAgent: mocks.proxyAgent }));
rs.mock('../logging', () => ({ ze_log: { error: rs.fn() } }));
rs.mock('../logging/ze-log-event', () => ({ logFn: rs.fn() }));

const proxyEnvironmentKeys = [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'http_proxy',
  'https_proxy',
  'NO_PROXY',
  'no_proxy',
] as const;
const originalProxyEnvironment = Object.fromEntries(
  proxyEnvironmentKeys.map((key) => [key, process.env[key]])
);

function clearProxyEnvironment(): void {
  for (const key of proxyEnvironmentKeys) delete process.env[key];
}

describe('fetchWithRetries', () => {
  const url = new URL('https://example.com/api');

  beforeEach(() => {
    rs.clearAllMocks();
    clearProxyEnvironment();
    mocks.axiosCreate.mockReturnValue(mocks.axiosInstance);
  });

  afterEach(() => {
    clearProxyEnvironment();
    for (const key of proxyEnvironmentKeys) {
      const value = originalProxyEnvironment[key];
      if (value !== undefined) process.env[key] = value;
    }
  });

  it('sets an overall per-request deadline and keeps HTTP statuses in-band', async () => {
    mocks.axiosInstance.mockResolvedValue({
      status: 401,
      headers: { 'content-type': 'text/plain' },
      data: 'Unauthorized',
    });

    const response = await fetchWithRetries(url, {
      method: 'GET',
      headers: { Accept: 'text/plain' },
    });

    expect(response.status).toBe(401);
    expect(response.ok).toBe(false);
    expect(await response.text()).toBe('Unauthorized');
    expect(mocks.axiosCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        family: undefined,
        httpsAgent: undefined,
        validateStatus: expect.any(Function),
      })
    );
    expect(mocks.axiosInstance).toHaveBeenCalledWith(
      url.toString(),
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'text/plain' },
        timeout: expect.any(Number),
      })
    );
    const requestConfig = mocks.axiosInstance.mock.calls[0][1];
    expect(requestConfig.timeout).toBeGreaterThan(0);
    expect(requestConfig.timeout).toBeLessThanOrEqual(DEFAULT_HTTP_DEADLINE_MS);
  });

  it('does not retry non-idempotent POST requests after an ambiguous server failure', async () => {
    mocks.axiosInstance.mockResolvedValue({ status: 503, headers: {}, data: 'retry' });

    const response = await fetchWithRetries(
      url,
      { method: 'POST', body: JSON.stringify({ mutation: true }) },
      3
    );

    expect(response.status).toBe(503);
    expect(mocks.axiosInstance).toHaveBeenCalledTimes(1);
  });

  it('retries POST requests only when the caller supplies an idempotency key', async () => {
    mocks.axiosInstance
      .mockResolvedValueOnce({
        status: 429,
        headers: { 'retry-after': '0' },
        data: 'retry',
      })
      .mockResolvedValueOnce({ status: 200, headers: {}, data: { ok: true } });

    const response = await fetchWithRetries(
      url,
      {
        method: 'POST',
        body: JSON.stringify({ mutation: true }),
        headers: { 'Idempotency-Key': 'stable-build-identity' },
      },
      2
    );

    expect(response.status).toBe(200);
    expect(mocks.axiosInstance).toHaveBeenCalledTimes(2);
  });

  it('retries retry-safe GET responses and returns the successful attempt', async () => {
    mocks.axiosInstance
      .mockResolvedValueOnce({ status: 503, headers: {}, data: 'retry' })
      .mockResolvedValueOnce({ status: 200, headers: {}, data: { ok: true } });

    const response = await fetchWithRetries(url, { method: 'GET' }, 2);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.axiosInstance).toHaveBeenCalledTimes(2);
  });

  it('retries retry-safe network failures', async () => {
    mocks.axiosInstance
      .mockRejectedValueOnce({ code: 'ECONNRESET', message: 'socket hang up' })
      .mockResolvedValueOnce({ status: 204, headers: {}, data: '' });

    const response = await fetchWithRetries(url, { method: 'HEAD' }, 2);

    expect(response.status).toBe(204);
    expect(mocks.axiosInstance).toHaveBeenCalledTimes(2);
  });

  it('stops retrying when the overall deadline is exhausted', async () => {
    mocks.axiosInstance.mockRejectedValue({
      code: 'ETIMEDOUT',
      message: 'connect timeout',
    });

    await expect(fetchWithRetries(url, { method: 'GET' }, 3, 1)).rejects.toThrow(
      ZephyrError
    );
    expect(mocks.axiosInstance).toHaveBeenCalledTimes(1);
    expect(mocks.axiosInstance.mock.calls[0][1].timeout).toBeGreaterThan(0);
  });

  it('never retries an aborted request', async () => {
    const controller = new AbortController();
    controller.abort();
    mocks.axiosInstance.mockRejectedValue({
      code: 'ERR_CANCELED',
      message: 'canceled',
    });

    await expect(
      fetchWithRetries(url, { method: 'GET', signal: controller.signal }, 3)
    ).rejects.toThrow(ZephyrError);
    expect(mocks.axiosInstance).toHaveBeenCalledTimes(1);
  });

  it('redacts presigned URL and response secrets from normalized errors', async () => {
    const signature = 'raw-retry-signature';
    const token = 'raw-retry-token';
    const secretUrl = new URL(
      `https://uploads.example/file?X-Amz-Signature=${signature}`
    );
    mocks.axiosInstance.mockRejectedValue({
      response: {
        status: 502,
        data: { access_token: token },
      },
    });

    let error: unknown;
    try {
      await fetchWithRetries(secretUrl, { method: 'POST' });
    } catch (caught) {
      error = caught;
    }

    const serialized = JSON.stringify(error);
    expect(error).toBeInstanceOf(ZephyrError);
    expect(serialized).toContain('uploads.example/file');
    expect(serialized).toContain('502');
    expect(serialized).not.toContain(signature);
    expect(serialized).not.toContain(token);
  });

  it('uses the configured HTTPS proxy unless NO_PROXY matches', async () => {
    process.env['HTTPS_PROXY'] = 'http://proxy.example.com:8080';
    mocks.axiosInstance.mockResolvedValue({ status: 200, headers: {}, data: 'ok' });

    await fetchWithRetries(url);

    expect(mocks.proxyAgent).toHaveBeenCalledWith('http://proxy.example.com:8080');
    expect(mocks.axiosCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        httpsAgent: expect.objectContaining({
          proxyUrl: 'http://proxy.example.com:8080',
        }),
      })
    );

    rs.clearAllMocks();
    mocks.axiosCreate.mockReturnValue(mocks.axiosInstance);
    process.env['NO_PROXY'] = 'example.com';
    await fetchWithRetries(url);

    expect(mocks.proxyAgent).not.toHaveBeenCalled();
  });
});
