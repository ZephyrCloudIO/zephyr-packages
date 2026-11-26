import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { ZeErrors, ZephyrError } from '../errors';
import { DEFAULT_HTTP_DEADLINE_MS, fetchWithRetries } from './fetch-with-retries';
import { formatUserAgent, withRequestIdentity } from './request-identity';

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
rs.mock('ci-info', () => ({ isCI: false }));
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

  it('explains DNS lookup failures without claiming a POST was retried', async () => {
    const signature = 'raw-dns-signature';
    const missingUrl = new URL(
      `https://missing.example.com/api?X-Amz-Signature=${signature}`
    );
    mocks.axiosInstance.mockRejectedValue({
      code: 'ENOTFOUND',
      message: `getaddrinfo ENOTFOUND missing.example.com?token=${signature}`,
    });

    let error: unknown;
    try {
      await fetchWithRetries(missingUrl, { method: 'POST' }, 3);
    } catch (caught) {
      error = caught;
    }

    const serialized = JSON.stringify(error);
    expect(ZephyrError.is(error, ZeErrors.ERR_ZEPHYR_UNREACHABLE)).toBe(true);
    expect(serialized).toContain('DNS lookup failed');
    expect(serialized).toContain('missing.example.com');
    expect(serialized).toContain('ENOTFOUND');
    expect(serialized).toContain("Verify the hostname's DNS record");
    expect(serialized).not.toContain('after retries');
    expect(serialized).not.toContain(signature);
    expect(mocks.axiosInstance).toHaveBeenCalledTimes(1);
  });

  it('reports the proxy hostname when proxy DNS lookup fails', async () => {
    const proxyHostname = 'missing-proxy.internal';
    const proxyUrl = `http://${proxyHostname}:8080`;
    process.env['HTTPS_PROXY'] = proxyUrl;
    mocks.axiosInstance.mockRejectedValue({
      code: 'ENOTFOUND',
      message: `getaddrinfo ENOTFOUND ${proxyHostname}`,
      cause: {
        code: 'ENOTFOUND',
        hostname: proxyHostname,
        syscall: 'getaddrinfo',
      },
    });

    let error: unknown;
    try {
      await fetchWithRetries(url, { method: 'POST' });
    } catch (caught) {
      error = caught;
    }

    const serialized = JSON.stringify(error);
    expect(ZephyrError.is(error, ZeErrors.ERR_ZEPHYR_UNREACHABLE)).toBe(true);
    expect(serialized).toContain('DNS lookup failed');
    expect(serialized).toContain(proxyHostname);
    expect(mocks.proxyAgent).toHaveBeenCalledWith(proxyUrl);
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

  it.each([
    ['ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:1', 'network'],
    ['ECONNABORTED', 'timeout of 30000ms exceeded', 'timeout'],
    ['ETIMEDOUT', 'connect ETIMEDOUT', 'timeout'],
  ])(
    'reports %s as the unreachable class, not a config error',
    async (code, message, failure) => {
      mocks.axiosInstance.mockRejectedValue({ code, message });

      let error: unknown;
      try {
        await fetchWithRetries(url, { method: 'GET' }, 0);
      } catch (caught) {
        error = caught;
      }

      expect(ZephyrError.is(error, ZeErrors.ERR_ZEPHYR_UNREACHABLE)).toBe(true);
      expect((error as ZephyrError<'ERR_ZEPHYR_UNREACHABLE'>).code).toBe('ZE50001');
      expect((error as ZephyrError<'ERR_ZEPHYR_UNREACHABLE'>).data).toMatchObject({
        failure,
      });
    }
  );

  it('keeps a caller abort out of the unreachable class', async () => {
    mocks.axiosInstance.mockRejectedValue({ code: 'ERR_CANCELED', message: 'canceled' });

    let error: unknown;
    try {
      await fetchWithRetries(url, { method: 'GET' }, 0);
    } catch (caught) {
      error = caught;
    }

    expect(ZephyrError.is(error, ZeErrors.ERR_HTTP_ERROR)).toBe(true);
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

describe('fetchWithRetries request identity', () => {
  const apiUrl = new URL('https://zeapi.zephyrcloud.app/v2/application/logs');
  const edgeUrl = new URL('https://edge.example/upload?type=file');
  const presignedUrl = new URL(
    'https://bucket.s3.amazonaws.com/hash?X-Amz-Signature=runtime-signature'
  );
  const identity = {
    buildId: '11887',
    builder: 'webpack',
    plugin: 'zephyr-webpack-plugin',
    pluginVersion: '1.8.0',
    zephyrOrigins: ['https://edge.example'],
  };
  const userAgentPattern =
    /^zephyr-agent\/[^ ]+ \(webpack; zephyr-webpack-plugin\/1\.8\.0; node\/[^ )]+\)$/;
  const savedApiGate = process.env['ZE_API_GATE'];
  const savedApi = process.env['ZE_API'];

  function sentHeaders(callIndex = 0): Record<string, string> | undefined {
    return mocks.axiosInstance.mock.calls[callIndex]?.[1]?.headers;
  }

  function headerNames(callIndex = 0): string[] {
    return Object.keys(sentHeaders(callIndex) ?? {}).map((name) => name.toLowerCase());
  }

  beforeEach(() => {
    rs.clearAllMocks();
    delete process.env['ZE_API_GATE'];
    delete process.env['ZE_API'];
    mocks.axiosCreate.mockReturnValue(mocks.axiosInstance);
    mocks.axiosInstance.mockResolvedValue({ status: 200, headers: {}, data: 'ok' });
  });

  afterEach(() => {
    if (savedApiGate !== undefined) process.env['ZE_API_GATE'] = savedApiGate;
    if (savedApi !== undefined) process.env['ZE_API'] = savedApi;
  });

  it('identifies the agent and the build to the Zephyr API', async () => {
    await withRequestIdentity(identity, () =>
      fetchWithRetries(apiUrl, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      })
    );

    expect(sentHeaders()).toEqual({
      Accept: 'application/json',
      'User-Agent': expect.stringMatching(userAgentPattern),
      'x-ze-build-id': '11887',
    });
  });

  it('identifies the build to the application edge declared for the scope', async () => {
    await withRequestIdentity(identity, () =>
      fetchWithRetries(edgeUrl, { method: 'POST' })
    );

    expect(sentHeaders()).toMatchObject({ 'x-ze-build-id': '11887' });
  });

  it('sends a presigned PUT neither the User-Agent nor the build ID', async () => {
    const headers = { 'Content-Type': 'application/octet-stream' };
    await withRequestIdentity(identity, () =>
      fetchWithRetries(presignedUrl, { method: 'PUT', headers }, 0)
    );

    expect(sentHeaders()).toEqual(headers);
    expect(headerNames()).not.toContain('user-agent');
    expect(headerNames()).not.toContain('x-ze-build-id');
  });

  it('sends no identity to third-party hosts, even with no caller headers', async () => {
    await withRequestIdentity(identity, () =>
      fetchWithRetries(new URL('https://registry.npmjs.org/-/package/x/dist-tags'))
    );

    expect(sentHeaders()).toBeUndefined();
  });

  it('never overrides caller-supplied headers, whatever their case', async () => {
    await withRequestIdentity(identity, () =>
      fetchWithRetries(apiUrl, {
        method: 'GET',
        headers: { 'user-agent': 'custom-client/1.0', 'X-ZE-Build-Id': 'caller-build' },
      })
    );

    expect(sentHeaders()).toEqual({
      'user-agent': 'custom-client/1.0',
      'X-ZE-Build-Id': 'caller-build',
    });
  });

  it('sends the User-Agent without a build ID outside a build', async () => {
    await fetchWithRetries(apiUrl, { method: 'GET' });

    expect(sentHeaders()).toEqual({
      'User-Agent': expect.stringMatching(/^zephyr-agent\/[^ ]+ \(node\/[^ )]+\)$/),
    });
  });

  it('follows a custom API gateway and keeps nested scopes isolated', async () => {
    process.env['ZE_API_GATE'] = 'https://api.self-hosted.example';
    const url = new URL('https://api.self-hosted.example/logs');

    await Promise.all([
      withRequestIdentity({ buildId: 'build-a' }, () => fetchWithRetries(url)),
      withRequestIdentity({ buildId: 'build-b' }, () => fetchWithRetries(url)),
    ]);

    const buildIds = mocks.axiosInstance.mock.calls.map(
      ([, config]) => config.headers['x-ze-build-id']
    );
    expect(buildIds.sort()).toEqual(['build-a', 'build-b']);
  });
});

describe('formatUserAgent', () => {
  it('drops unknown parts and keeps the agent prefix', () => {
    expect(formatUserAgent({ builder: 'vite' })).toMatch(
      /^zephyr-agent\/[^ ]+ \(vite; node\/[^ )]+\)$/
    );
    expect(formatUserAgent({ plugin: 'zephyr-cli', builder: 'unknown' })).toMatch(
      /^zephyr-agent\/[^ ]+ \(zephyr-cli; node\/[^ )]+\)$/
    );
  });

  it('removes characters that are invalid in a header', () => {
    expect(formatUserAgent({ builder: 'vite\r\nx-injected: 1' })).not.toMatch(/[\r\n:]/);
  });
});
