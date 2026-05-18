import { getToken } from './token';
import { inferCiTokenIdentity } from './ci-token-identity';
import { makeRequest } from '../http/http-request';
import { ZeErrors, ZephyrError } from '../errors';

jest.mock('node-persist', () => ({
  clear: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('./storage', () => ({
  storage: Promise.resolve(),
}));

jest.mock('./ci-token-identity', () => ({
  inferCiTokenIdentity: jest.fn(),
}));

jest.mock('../http/http-request', () => ({
  makeRequest: jest.fn(),
}));

const mockInferCiTokenIdentity = inferCiTokenIdentity as jest.MockedFunction<
  typeof inferCiTokenIdentity
>;
const mockMakeRequest = makeRequest as jest.MockedFunction<typeof makeRequest>;

describe('getToken', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
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
