import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';

import { getToken, saveToken } from './token';
import { inferCiTokenIdentity } from './ci-token-identity';
import { makeRequest } from '../http/http-request';
import { ZeErrors, ZephyrError } from '../errors';

rs.mock('node-persist', () => ({
  clear: rs.fn(),
  getItem: rs.fn(),
  removeItem: rs.fn(),
  setItem: rs.fn(),
}));

rs.mock('./storage', () => ({
  storage: Promise.resolve(),
  setPrivateItem: rs.fn(),
}));

rs.mock('./ci-token-identity', () => ({
  inferCiTokenIdentity: rs.fn(),
}));

rs.mock('../http/http-request', () => ({
  makeRequest: rs.fn(),
}));

const mockInferCiTokenIdentity = inferCiTokenIdentity as Mock<
  typeof inferCiTokenIdentity
>;
const mockMakeRequest = makeRequest as Mock<typeof makeRequest>;

describe('getToken', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    rs.resetAllMocks();
    process.env = { ...originalEnv, ZE_CI_TOKEN: 'ci-token' };
    delete process.env['ZE_SECRET_TOKEN'];
    delete process.env['ZE_SERVER_TOKEN'];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws a CI-token-specific error when exchange is rejected', async () => {
    mockInferCiTokenIdentity.mockResolvedValue({
      provider: 'github',
      email: '12345+octocat@users.noreply.github.com',
      emails: ['12345+octocat@users.noreply.github.com'],
      issuer: 'https://github.com',
      providerSubject: '12345',
      username: 'octocat',
      source: 'noreply',
    });
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
});
