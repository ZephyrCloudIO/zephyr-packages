import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  getApplicationConfiguration: rs.fn(),
  getToken: rs.fn(),
  makeRequest: rs.fn(),
}));

rs.mock('../edge-requests/get-application-configuration', () => ({
  getApplicationConfiguration: mocks.getApplicationConfiguration,
}));
rs.mock('../http/http-request', () => ({ makeRequest: mocks.makeRequest }));
rs.mock('../node-persist/token', () => ({ getToken: mocks.getToken }));
rs.mock('./file-logger', () => ({
  isFileLoggingEnabled: rs.fn(() => false),
  writeLogToFile: rs.fn(),
}));
rs.mock('./debug', () => ({
  brightBlueBgName: '',
  brightGreenBgName: '',
  brightRedBgName: '',
  brightYellowBgName: '',
}));

import { logger } from './ze-log-event';

describe('remote Zephyr logging', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.getApplicationConfiguration.mockResolvedValue({
      user_uuid: 'user-id',
      username: 'developer',
    });
    mocks.getToken.mockResolvedValue('api-access-token');
    mocks.makeRequest.mockResolvedValue([true, null, undefined]);
  });

  it('redacts log and metadata secrets before uploading them', async () => {
    const signature = 'raw-remote-log-signature';
    const bearer = 'raw-remote-log-bearer';
    const logEvent = logger({
      application_uid: 'app.project.org',
      buildId: 'build-id',
      git: {
        name: 'Developer',
        email: 'developer@example.com',
        branch: `feature?token=${bearer}`,
        commit: 'commit-id',
        tags: [],
      },
    });

    logEvent({
      level: 'error',
      action: 'request:failed',
      message:
        `PUT https://uploads.example/file?X-Amz-Signature=${signature} ` +
        `Authorization: Bearer ${bearer}`,
    });

    await rs.waitFor(() => expect(mocks.makeRequest).toHaveBeenCalledTimes(1));

    const body = String(mocks.makeRequest.mock.calls[0]?.[2]);
    expect(body).toContain('uploads.example/file');
    expect(body).toContain('[REDACTED]');
    expect(body).not.toContain(signature);
    expect(body).not.toContain(bearer);
  });
});
