import { rs, type Mock } from '@rstest/core';
import { getToken } from './token';
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
});
