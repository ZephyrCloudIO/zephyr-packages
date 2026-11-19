import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { ZeErrors, ZephyrError } from '../../lib/errors';
import { getRequestIdentity } from '../../lib/http/request-identity';
import { logger } from '../../lib/logging/ze-log-event';
import { BuildSessionAbortedError } from '../build-session';
import { reportBuildFailure } from '../engine-telemetry';
import { ZephyrEngine } from '../index';

const mocks = rs.hoisted(() => ({
  makeRequest: rs.fn(),
  getApplicationConfiguration: rs.fn(),
  getToken: rs.fn(),
}));

rs.mock('../../lib/http/http-request', () => ({ makeRequest: mocks.makeRequest }));
rs.mock('../../lib/edge-requests/get-application-configuration', () => ({
  getApplicationConfiguration: mocks.getApplicationConfiguration,
}));
rs.mock('../../lib/node-persist/token', () => ({ getToken: mocks.getToken }));
rs.mock('../../lib/logging/file-logger', () => ({
  isFileLoggingEnabled: rs.fn(() => false),
  writeLogToFile: rs.fn(),
}));

const BUILD_ID = '11887';

/** An engine in the state a plugin sees mid-build, with the real remote logger. */
function activeEngine(): ZephyrEngine {
  const engine = Object.create(ZephyrEngine.prototype) as ZephyrEngine;
  engine.application_uid = 'app.project.org';
  engine.application_configuration = Promise.resolve({
    EDGE_URL: 'https://edge.example',
    user_uuid: 'user-id',
    username: 'developer',
  } as never);
  engine.builder = 'vite';
  engine.plugin_identity = { name: 'vite-plugin-zephyr', version: '1.8.0' };
  engine.env = { isCI: true, target: 'web' };
  engine.build_id = Promise.resolve(BUILD_ID);
  engine.snapshotId = Promise.resolve('snapshot-id');
  engine.build_start_time = Date.now() - 50;
  engine.build_failure_reported = false;
  engine.logger = Promise.resolve(
    logger({
      application_uid: 'app.project.org',
      buildId: BUILD_ID,
      git: {
        name: 'Developer',
        email: 'dev@example.com',
        branch: 'main',
        commit: 'c0ffee',
      },
      context: { builder: 'vite', plugin: 'vite-plugin-zephyr', plugin_version: '1.8.0' },
    })
  );
  return engine;
}

function sentEvents(): Array<Record<string, unknown>> {
  return mocks.makeRequest.mock.calls.flatMap(
    (call) => JSON.parse(String(call[2])) as Array<Record<string, unknown>>
  );
}

describe('build:failed reporting', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    rs.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.getApplicationConfiguration.mockResolvedValue({
      user_uuid: 'user-id',
      username: 'developer',
    });
    mocks.getToken.mockResolvedValue('api-access-token');
    mocks.makeRequest.mockResolvedValue([true, null, undefined]);
  });

  it('reports a non-xpack plugin failure with a structured error and flushes it', async () => {
    const engine = activeEngine();
    const failure = new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'file',
      cause: new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
        status: 413,
        url: 'https://edge.example/upload',
        content: 'too large',
        method: 'POST',
      }),
    });

    // What a Vite, Rollup, Astro or CLI catch block does.
    const delivered = engine.build_failed(failure);

    // The reset stays synchronous so a new generation cannot reuse failed state.
    expect(engine.hasActiveBuild).toBe(false);
    await delivered;

    // Awaiting build_failed waited for the send itself, not just for it to be queued.
    expect(mocks.makeRequest).toHaveBeenCalledTimes(1);
    const [event] = sentEvents();
    expect(event).toMatchObject({
      actionType: 'build:failed',
      logLevel: 'error',
      zeBuildId: BUILD_ID,
      context: { builder: 'vite', plugin: 'vite-plugin-zephyr', plugin_version: '1.8.0' },
      data: { outcome: 'failed', duration_ms: expect.any(Number) },
      error: {
        code: failure.code,
        name: 'ZephyrError',
        cause_status: 413,
      },
    });
    // The plugin prints the error itself; the report must not print it again.
    expect(console.error).not.toHaveBeenCalled();
  });

  it('reports a build failure once even when several paths report it', async () => {
    const engine = activeEngine();
    const failure = new Error('compilation failed');

    // A webpack-family build: the compiler `failed` hook and the plugin's catch block.
    const first = reportBuildFailure(engine, failure);
    const second = engine.build_failed(failure);
    const third = engine.build_failed(new Error('a later error'));
    await Promise.all([first, second, third]);

    const failedEvents = sentEvents().filter((e) => e['actionType'] === 'build:failed');
    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0]?.['error']).toEqual({
      code: 'ZE00000',
      name: 'Error',
      message: 'compilation failed',
    });
  });

  it('reports again for the next build generation', async () => {
    const engine = activeEngine();
    await engine.build_failed(new Error('first build'));

    // start_new_build allocates a new generation and clears the flag.
    engine.build_id = Promise.resolve('11888');
    engine.build_failure_reported = false;
    await engine.build_failed(new Error('second build'));

    expect(sentEvents().filter((e) => e['actionType'] === 'build:failed')).toHaveLength(
      2
    );
  });

  it('does not report a superseded watch generation or a release without error', async () => {
    const aborted = activeEngine();
    await aborted.build_failed(
      new BuildSessionAbortedError('Superseded by generation 2')
    );

    const released = activeEngine();
    await released.build_failed();

    expect(mocks.makeRequest).not.toHaveBeenCalled();
    expect(aborted.hasActiveBuild).toBe(false);
    expect(released.hasActiveBuild).toBe(false);
  });

  it('never rejects when the logger cannot be created', async () => {
    const engine = activeEngine();
    const rejected = Promise.reject(new Error('no logger'));
    rejected.catch(() => undefined);
    engine.logger = rejected;

    await expect(engine.build_failed(new Error('boom'))).resolves.toBeUndefined();
    expect(engine.hasActiveBuild).toBe(false);
  });

  it('settles within the deadline while the logger is still initializing', async () => {
    const engine = activeEngine();
    // e.g. the build ID or application configuration request is still in flight
    engine.logger = new Promise(() => undefined);

    const started = Date.now();
    await expect(
      reportBuildFailure(engine, new Error('boom'), 30)
    ).resolves.toBeUndefined();
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('sends the log POST with the build identity', async () => {
    let identityDuringSend: ReturnType<typeof getRequestIdentity>;
    mocks.makeRequest.mockImplementation(async () => {
      identityDuringSend = getRequestIdentity();
      return [true, null, undefined];
    });

    await activeEngine().build_failed(new Error('boom'));

    expect(identityDuringSend!).toMatchObject({
      buildId: BUILD_ID,
      builder: 'vite',
      plugin: 'vite-plugin-zephyr',
      pluginVersion: '1.8.0',
    });
  });
});
