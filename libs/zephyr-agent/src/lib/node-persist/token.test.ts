import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';

import * as jose from 'jose';
import { cleanTokens, getToken, saveToken } from './token';
import { inferCiTokenIdentity } from './ci-token-identity';
import { makeRequest } from '../http/http-request';
import { ZeErrors, ZephyrError } from '../errors';
import { withStorageLock } from './storage-lock';

rs.mock('node-persist', () => ({
  clear: rs.fn(),
  getItem: rs.fn(),
  removeItem: rs.fn(),
  setItem: rs.fn(),
}));

rs.mock('jose', () => ({
  decodeJwt: rs.fn(),
}));

rs.mock('./storage', () => ({
  storage: Promise.resolve(),
  setPrivateItem: rs.fn(),
}));

rs.mock('./ci-token-identity', () => ({
  inferCiTokenIdentity: rs.fn(),
}));

rs.mock('./storage-lock', () => ({
  withStorageLock: rs.fn(),
}));

rs.mock('../http/http-request', () => ({
  makeRequest: rs.fn(),
}));

const mockInferCiTokenIdentity = inferCiTokenIdentity as Mock<
  typeof inferCiTokenIdentity
>;
const mockMakeRequest = makeRequest as Mock<typeof makeRequest>;
const mockDecodeJwt = jose.decodeJwt as Mock<typeof jose.decodeJwt>;
const mockWithStorageLock = withStorageLock as Mock<typeof withStorageLock>;

const githubIdentity = {
  provider: 'github' as const,
  email: '12345+octocat@users.noreply.github.com',
  emails: ['12345+octocat@users.noreply.github.com'],
  issuer: 'https://github.com',
  providerSubject: '12345',
  username: 'octocat',
  source: 'noreply' as const,
};

const githubBotIdentity = {
  ...githubIdentity,
  providerSubject: '29139614',
  username: 'renovate[bot]',
  providerActorType: 'bot' as const,
};

describe('getToken', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    rs.resetAllMocks();
    process.env = { ...originalEnv, ZE_CI_TOKEN: 'ci-token' };
    delete process.env['ZE_SECRET_TOKEN'];
    delete process.env['ZE_SERVER_TOKEN'];
    mockDecodeJwt.mockReturnValue({ exp: Date.now() / 1000 + 60 * 60 });
    mockWithStorageLock.mockImplementation(async (_name, action) => action());
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws a CI-token-specific error when exchange is rejected', async () => {
    mockInferCiTokenIdentity.mockResolvedValue(githubIdentity);
    mockMakeRequest.mockResolvedValue([
      false,
      new Error('GitHub identity is not linked to a Zephyr user'),
    ]);

    await expect(getToken()).rejects.toMatchObject({
      code: ZephyrError.toZeCode(ZeErrors.ERR_CI_TOKEN_AUTH),
      message: expect.stringContaining("Link this CI actor's Git provider account"),
    });
  });

  it('throws a CI-token-specific error when no supported CI identity is detected', async () => {
    mockInferCiTokenIdentity.mockResolvedValue(undefined);

    await expect(getToken()).rejects.toMatchObject({
      code: ZephyrError.toZeCode(ZeErrors.ERR_CI_TOKEN_AUTH),
      message: expect.stringContaining('no supported CI identity was detected'),
    });
  });

  it('gives bot-specific authorization guidance when exchange is rejected', async () => {
    mockInferCiTokenIdentity.mockResolvedValue(githubBotIdentity);
    mockMakeRequest.mockResolvedValue([
      false,
      new Error('CI token creator is not an active organization member'),
    ]);

    await expect(getToken()).rejects.toMatchObject({
      code: ZephyrError.toZeCode(ZeErrors.ERR_CI_TOKEN_AUTH),
      message: expect.stringContaining('This bot is authorized by the CI token creator'),
    });
  });

  it('persists CI-derived access tokens in an identity-scoped cache', async () => {
    mockInferCiTokenIdentity.mockResolvedValue(githubIdentity);
    mockMakeRequest.mockResolvedValue([true, null, { access_token: 'ci-access-token' }]);
    const { setPrivateItem } = await import('./storage');

    await expect(getToken()).resolves.toBe('ci-access-token');

    expect(setPrivateItem).toHaveBeenCalledWith(
      expect.stringMatching(/^ze-ci-auth-token:[a-f0-9]{64}$/),
      expect.objectContaining({
        version: 1,
        accessToken: 'ci-access-token',
        scope: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      expect.objectContaining({ ttl: expect.any(Number) })
    );
  });

  it('reuses a valid persisted CI access token without another exchange', async () => {
    mockInferCiTokenIdentity.mockResolvedValue(githubIdentity);
    mockMakeRequest.mockResolvedValue([true, null, { access_token: 'cached-token' }]);
    const { getItem } = await import('node-persist');
    const { setPrivateItem } = await import('./storage');

    await getToken();
    const [, cachedValue] = (setPrivateItem as Mock<typeof setPrivateItem>).mock.calls[0];
    (getItem as Mock<typeof getItem>).mockResolvedValue(cachedValue);
    mockMakeRequest.mockClear();

    await expect(getToken()).resolves.toBe('cached-token');
    expect(mockMakeRequest).not.toHaveBeenCalled();
  });

  it('exchanges a new CI access token when the API gateway changes', async () => {
    mockInferCiTokenIdentity.mockResolvedValue(githubIdentity);
    mockMakeRequest
      .mockResolvedValueOnce([true, null, { access_token: 'dev-token' }])
      .mockResolvedValueOnce([true, null, { access_token: 'prod-token' }]);
    const { getItem } = await import('node-persist');
    const { setPrivateItem } = await import('./storage');
    const persisted = new Map<string, unknown>();
    (getItem as Mock<typeof getItem>).mockImplementation(async (key) =>
      persisted.get(String(key))
    );
    (setPrivateItem as Mock<typeof setPrivateItem>).mockImplementation(
      async (key, value) => {
        persisted.set(key, value);
      }
    );

    process.env['ZE_API_GATE'] = 'https://dev-api.example';
    await expect(getToken()).resolves.toBe('dev-token');
    process.env['ZE_API_GATE'] = 'https://prod-api.example';
    await expect(getToken()).resolves.toBe('prod-token');

    expect(mockMakeRequest).toHaveBeenCalledTimes(2);
    expect([...persisted.keys()]).toHaveLength(2);
  });

  it('serializes concurrent callers so only one exchanges the CI token', async () => {
    mockInferCiTokenIdentity.mockResolvedValue(githubIdentity);
    let persisted: unknown;
    let lockQueue = Promise.resolve();
    mockWithStorageLock.mockImplementation((_name, action) => {
      const result = lockQueue.then(action);
      lockQueue = result.then(
        () => undefined,
        () => undefined
      );
      return result;
    });
    const { getItem } = await import('node-persist');
    const { setPrivateItem } = await import('./storage');
    (getItem as Mock<typeof getItem>).mockImplementation(async () => persisted);
    (setPrivateItem as Mock<typeof setPrivateItem>).mockImplementation(
      async (_key, value) => {
        persisted = value;
      }
    );
    mockMakeRequest.mockResolvedValue([true, null, { access_token: 'shared-token' }]);

    await expect(Promise.all([getToken(), getToken(), getToken()])).resolves.toEqual([
      'shared-token',
      'shared-token',
      'shared-token',
    ]);
    expect(mockMakeRequest).toHaveBeenCalledTimes(1);
  });

  it('refreshes an expired persisted CI access token', async () => {
    mockInferCiTokenIdentity.mockResolvedValue(githubIdentity);
    mockMakeRequest.mockResolvedValue([true, null, { access_token: 'initial-token' }]);
    const { getItem } = await import('node-persist');
    const { setPrivateItem } = await import('./storage');

    await getToken();
    const [, cachedValue] = (setPrivateItem as Mock<typeof setPrivateItem>).mock.calls[0];
    (getItem as Mock<typeof getItem>).mockResolvedValue({
      ...(cachedValue as object),
      accessToken: 'expired-token',
    });
    mockDecodeJwt.mockImplementation((token) => ({
      exp: Date.now() / 1000 + (token === 'expired-token' ? -60 : 60 * 60),
    }));
    mockMakeRequest.mockClear();
    mockMakeRequest.mockResolvedValue([true, null, { access_token: 'refreshed-token' }]);

    await expect(getToken()).resolves.toBe('refreshed-token');
    expect(mockMakeRequest).toHaveBeenCalledTimes(1);
  });

  it('rejects and does not persist an invalid exchanged access token', async () => {
    mockInferCiTokenIdentity.mockResolvedValue(githubIdentity);
    mockDecodeJwt.mockReturnValue({});
    mockMakeRequest.mockResolvedValue([true, null, { access_token: 'invalid-token' }]);
    const { removeItem } = await import('node-persist');
    const { setPrivateItem } = await import('./storage');

    await expect(getToken()).rejects.toMatchObject({
      code: ZephyrError.toZeCode(ZeErrors.ERR_CI_TOKEN_AUTH),
    });

    expect(setPrivateItem).not.toHaveBeenCalled();
    expect(removeItem).toHaveBeenCalledWith(
      expect.stringMatching(/^ze-ci-auth-token:[a-f0-9]{64}$/)
    );
  });

  it('persists browser access tokens through the private storage writer', async () => {
    const { setPrivateItem } = await import('./storage');

    await saveToken('browser-access-token');

    expect(setPrivateItem).toHaveBeenCalledWith('ze-auth-token', 'browser-access-token');
  });

  it('prefers an explicit server principal over cached browser authentication', async () => {
    delete process.env['ZE_CI_TOKEN'];
    process.env['ZE_SERVER_TOKEN'] = 'server-principal-token';
    const { getItem } = await import('node-persist');
    const { setPrivateItem } = await import('./storage');
    (getItem as Mock<typeof getItem>).mockResolvedValue('cached-browser-token');
    mockMakeRequest.mockResolvedValue([
      true,
      null,
      { access_token: 'server-access-token' },
    ]);

    const token = await getToken({
      git: { email: 'developer@example.com' },
    } as never);

    expect(token).toBe('server-access-token');
    expect(getItem).not.toHaveBeenCalled();
    expect(mockMakeRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer server-principal-token',
        }),
      })
    );
    expect(setPrivateItem).toHaveBeenCalledWith('ze-auth-token', 'server-access-token');
  });

  it('reuses the exchanged server access token when a config lookup has no git context', async () => {
    delete process.env['ZE_CI_TOKEN'];
    process.env['ZE_SERVER_TOKEN'] = 'server-principal-token';
    const { getItem } = await import('node-persist');
    (getItem as Mock<typeof getItem>).mockResolvedValue('exchanged-server-access-token');

    await expect(getToken()).resolves.toBe('exchanged-server-access-token');

    expect(mockMakeRequest).not.toHaveBeenCalled();
  });

  it('cleans only authentication records, not all persisted deployment state', async () => {
    mockInferCiTokenIdentity.mockResolvedValue(githubIdentity);
    mockMakeRequest.mockResolvedValue([true, null, { access_token: 'ci-access-token' }]);
    const { clear, removeItem } = await import('node-persist');

    await getToken();
    await cleanTokens();

    expect(clear).not.toHaveBeenCalled();
    expect(removeItem).toHaveBeenCalledWith('ze-auth-token');
    expect(removeItem).toHaveBeenCalledWith(
      expect.stringMatching(/^ze-ci-auth-token:[a-f0-9]{64}$/)
    );
  });

  it('does not let a delayed 401 remove a newer persisted token', async () => {
    mockInferCiTokenIdentity.mockResolvedValue(githubIdentity);
    mockMakeRequest.mockResolvedValue([true, null, { access_token: 'new-token' }]);
    const { getItem, removeItem } = await import('node-persist');
    const { setPrivateItem } = await import('./storage');

    await getToken();
    const [cacheKey, cachedValue] = (setPrivateItem as Mock<typeof setPrivateItem>).mock
      .calls[0];
    (getItem as Mock<typeof getItem>).mockImplementation(async (key) =>
      key === cacheKey ? cachedValue : 'new-token'
    );
    (removeItem as Mock<typeof removeItem>).mockClear();

    await cleanTokens('old-token');

    expect(removeItem).not.toHaveBeenCalled();
  });

  it('retains CI cache tracking when a delayed 401 preserves a newer token', async () => {
    mockInferCiTokenIdentity.mockResolvedValue(githubIdentity);
    mockMakeRequest.mockResolvedValue([true, null, { access_token: 'new-token' }]);
    const { getItem, removeItem } = await import('node-persist');
    const { setPrivateItem } = await import('./storage');

    await getToken();
    const [cacheKey, cachedValue] = (setPrivateItem as Mock<typeof setPrivateItem>).mock
      .calls[0];
    (getItem as Mock<typeof getItem>).mockImplementation(async (key) =>
      key === cacheKey ? cachedValue : undefined
    );
    (removeItem as Mock<typeof removeItem>).mockClear();

    await cleanTokens('old-token');
    await cleanTokens('new-token');

    expect(removeItem).toHaveBeenCalledWith(cacheKey);
  });
});
