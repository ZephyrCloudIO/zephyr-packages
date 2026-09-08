import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { ZeErrors, ZephyrError } from '../errors';
import { getBuildId } from './get-build-id';

const mocks = rs.hoisted(() => ({
  getApplicationConfiguration: rs.fn(),
  getToken: rs.fn(),
  makeRequest: rs.fn(),
}));

rs.mock('./get-application-configuration', () => ({
  getApplicationConfiguration: mocks.getApplicationConfiguration,
}));
rs.mock('../node-persist/token', () => ({ getToken: mocks.getToken }));
rs.mock('../http/http-request', () => ({ makeRequest: mocks.makeRequest }));
rs.mock('../logging', () => ({ ze_log: { app: rs.fn() } }));

describe('getBuildId', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.getApplicationConfiguration.mockResolvedValue({
      BUILD_ID_ENDPOINT: 'https://build-id.example/',
      user_uuid: 'user-123',
      jwt: 'write-capability',
      username: 'developer',
    });
    mocks.getToken.mockResolvedValue('access-token');
  });

  it('preserves a forbidden reason while naming the Build-ID operation', async () => {
    const cause = new ZephyrError(ZeErrors.ERR_AUTH_FORBIDDEN_ERROR, {
      message: 'Write access denied for app.project.org',
    });
    mocks.makeRequest.mockResolvedValue([false, cause]);

    await expect(getBuildId('app.project.org')).rejects.toMatchObject({
      code: 'ZE10019',
      operation: 'create-build-id',
      reason: 'ZE10022',
      cause,
    });
  });

  it('does not retain an unexpected Build-ID response payload', async () => {
    mocks.makeRequest.mockResolvedValue([
      true,
      null,
      { unexpected: 'private-authentication-payload' },
    ]);

    const error = await getBuildId('app.project.org').catch((value) => value);

    expect(error).toMatchObject({
      code: 'ZE10019',
      operation: 'create-build-id',
      reason: 'ZE10019',
      data: { responseKeys: ['unexpected'] },
    });
    expect(JSON.stringify(error)).not.toContain('private-authentication-payload');
  });

  it('preserves service unavailability as the Build-ID reason', async () => {
    const cause = new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
      method: 'GET',
      url: 'https://build-id.example/',
      status: 503,
      content: 'Service unavailable',
    });
    mocks.makeRequest.mockResolvedValue([false, cause]);

    await expect(getBuildId('app.project.org')).rejects.toMatchObject({
      code: 'ZE10019',
      operation: 'create-build-id',
      reason: 'ZE40035',
      cause,
    });
  });

  it('returns a Build ID using scoped authentication credentials', async () => {
    mocks.makeRequest.mockResolvedValue([true, null, { 'user-123': 'build-456' }]);

    await expect(getBuildId('app.project.org')).resolves.toBe('build-456');
    expect(mocks.makeRequest).toHaveBeenCalledWith('https://build-id.example/', {
      headers: {
        can_write_jwt: 'write-capability',
        Authorization: 'Bearer access-token',
      },
      credentialToken: 'access-token',
    });
  });
});
