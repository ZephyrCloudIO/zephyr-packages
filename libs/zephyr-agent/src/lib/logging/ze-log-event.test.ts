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

import { ZeErrors, ZephyrError } from '../errors';
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

  const git = {
    name: 'Developer',
    email: 'developer@example.com',
    branch: 'main',
    commit: 'commit-id',
    tags: [],
  };

  function sentEvents(callIndex = 0): Array<Record<string, unknown>> {
    return JSON.parse(String(mocks.makeRequest.mock.calls[callIndex]?.[2]));
  }

  it('sends context, data and a structured error next to the unchanged message', async () => {
    const logEvent = logger({
      application_uid: 'app.project.org',
      buildId: '11887',
      git,
      context: {
        builder: 'webpack',
        plugin: 'zephyr-webpack-plugin',
        plugin_version: '1.8.0',
        agent_version: '1.8.0',
        node_version: '24.0.0',
        ci: true,
        target: 'web',
        env: undefined,
      },
    });
    const error = new ZephyrError(ZeErrors.ERR_SNAPSHOT_UPLOADS_NO_RESULTS);

    logEvent(
      {
        level: 'info',
        action: 'snapshot:assets:upload:done',
        message: '(664/675 assets uploaded in 14067ms, 151699.31kb)',
        data: { assets_uploaded: 664, assets_total: 675, bytes: 155340093 },
      },
      {
        level: 'error',
        action: 'snapshot:upload:failed',
        message: 'failed uploading of ci snapshot to zephyr',
        error,
      },
      // Events without data or error keep the original envelope.
      { level: 'info', action: 'deploy:wait', message: 'Waiting...' }
    );

    await rs.waitFor(() => expect(mocks.makeRequest).toHaveBeenCalledTimes(1));
    const [done, failed, plain] = sentEvents();

    expect(done).toMatchObject({
      application_uid: 'app.project.org',
      userId: 'user-id',
      username: 'developer',
      zeBuildId: '11887',
      logLevel: 'info',
      actionType: 'snapshot:assets:upload:done',
      message: '(664/675 assets uploaded in 14067ms, 151699.31kb)',
      createdAt: expect.any(Number),
      git: expect.objectContaining({ branch: 'main', commit: 'commit-id' }),
      data: { assets_uploaded: 664, assets_total: 675, bytes: 155340093 },
    });
    // Unknown context values are left out rather than sent as null.
    expect(done?.['context']).toEqual({
      builder: 'webpack',
      plugin: 'zephyr-webpack-plugin',
      plugin_version: '1.8.0',
      agent_version: '1.8.0',
      node_version: '24.0.0',
      ci: true,
      target: 'web',
    });
    expect(done).not.toHaveProperty('error');
    expect(failed?.['error']).toEqual({
      code: error.code,
      name: 'ZephyrError',
      message: error.message,
    });
    expect(plain).not.toHaveProperty('data');
    expect(plain).not.toHaveProperty('error');
  });

  it('redacts secrets inside context, data and error', async () => {
    const secret = 'raw-structured-secret';
    const logEvent = logger({
      application_uid: 'app.project.org',
      buildId: '11887',
      git,
      context: () => ({ env: `https://env.example/?token=${secret}` }),
    });

    logEvent({
      level: 'error',
      action: 'deploy:edge:failed',
      message: 'failed deploying local build to edge',
      data: {
        url: `https://uploads.example/file?X-Amz-Signature=${secret}`,
        upload_token: secret,
        nested: { note: `Authorization: Bearer ${secret}` },
      },
      error: new Error(`request failed: https://edge.example/?jwt=${secret}`),
    });

    await rs.waitFor(() => expect(mocks.makeRequest).toHaveBeenCalledTimes(1));
    const body = String(mocks.makeRequest.mock.calls[0]?.[2]);
    expect(body).not.toContain(secret);
    expect(body).toContain('uploads.example/file');
    const [event] = sentEvents();
    expect(event?.['data']).toMatchObject({ upload_token: '[REDACTED]' });
  });

  it('does not print remote-only events', async () => {
    const consoleError = rs.spyOn(console, 'error').mockImplementation(() => undefined);
    const logEvent = logger({ application_uid: 'app.project.org', git });

    logEvent({
      level: 'error',
      action: 'build:failed',
      message: 'already printed by the plugin',
      remoteOnly: true,
    });

    await rs.waitFor(() => expect(mocks.makeRequest).toHaveBeenCalledTimes(1));
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('flush waits for pending sends', async () => {
    let finishSend!: () => void;
    mocks.makeRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSend = () => resolve([true, null, undefined]);
        })
    );
    const logEvent = logger({ application_uid: 'app.project.org', git });
    logEvent({ level: 'error', action: 'build:failed', message: 'boom' });

    let flushed = false;
    const flush = logEvent.flush(5_000).then(() => {
      flushed = true;
    });
    await rs.waitFor(() => expect(mocks.makeRequest).toHaveBeenCalledTimes(1));
    expect(flushed).toBe(false);

    finishSend();
    await flush;
    expect(flushed).toBe(true);
  });

  it('flush gives up after its timeout and never rejects', async () => {
    mocks.makeRequest.mockImplementation(() => new Promise(() => undefined));
    const logEvent = logger({ application_uid: 'app.project.org', git });
    logEvent({ level: 'error', action: 'build:failed', message: 'boom' });

    const started = Date.now();
    await expect(logEvent.flush(30)).resolves.toBeUndefined();
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('flush resolves when log delivery fails', async () => {
    mocks.getToken.mockRejectedValue(new Error('no token'));
    const logEvent = logger({ application_uid: 'app.project.org', git });
    logEvent({ level: 'error', action: 'build:failed', message: 'boom' });

    await expect(logEvent.flush()).resolves.toBeUndefined();
    expect(mocks.makeRequest).not.toHaveBeenCalled();
  });
});
