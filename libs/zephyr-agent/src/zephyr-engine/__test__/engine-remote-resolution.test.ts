import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { ZeErrors, ZephyrError } from '../../lib/errors';
import { createUnreachableError } from '../../lib/http/http-failure';
import { ZephyrEngine } from '../index';

const mocks = rs.hoisted(() => ({
  resolve: rs.fn(),
  log: rs.fn(),
}));

rs.mock('../resolve_remote_dependency', () => ({
  resolve_remote_dependency: mocks.resolve,
}));
rs.mock('../../lib/logging', () => ({
  ze_log: { init: rs.fn(), app: rs.fn(), config: rs.fn(), remotes: rs.fn() },
}));
rs.mock('../../lib/logging/ze-log-event', () => ({
  logger: rs.fn(),
  logFn: rs.fn(),
}));

function engine(): ZephyrEngine {
  const value = Object.create(ZephyrEngine.prototype) as ZephyrEngine;
  value.application_configuration = Promise.resolve({ username: 'developer' } as never);
  value.npmProperties = { zephyrDependencies: undefined } as never;
  value.gitProperties = {
    git: { branch: 'main' },
    app: { org: 'o', project: 'p' },
  } as never;
  value.env = { isCI: false, target: 'web', ssr: false } as never;
  value.zephyrConfig = {} as never;
  Object.defineProperty(value, 'logger', { value: Promise.resolve(mocks.log) });
  return value;
}

const dependency = { name: 'remote', version: '1.0.0' };

describe('ZephyrEngine.resolve_remote_dependencies and ZE_FAIL_BUILD', () => {
  const originalFailBuild = process.env['ZE_FAIL_BUILD'];

  beforeEach(() => {
    rs.clearAllMocks();
    delete process.env['ZE_FAIL_BUILD'];
  });

  afterEach(() => {
    if (originalFailBuild === undefined) delete process.env['ZE_FAIL_BUILD'];
    else process.env['ZE_FAIL_BUILD'] = originalFailBuild;
  });

  function unreachable() {
    return createUnreachableError({
      method: 'GET',
      url: 'https://api.example.test/resolve/remote.p.o/1.0.0',
      failure: 'timeout',
      detail: 'The request timed out after retries (ECONNABORTED)',
    });
  }

  it('skips a remote that cannot be resolved and keeps building by default', async () => {
    mocks.resolve.mockRejectedValue(unreachable());

    await expect(engine().resolve_remote_dependencies([dependency])).resolves.toEqual([]);
  });

  it('fails the build for an unreachable Zephyr when ZE_FAIL_BUILD=true', async () => {
    process.env['ZE_FAIL_BUILD'] = 'true';
    const outage = unreachable();
    mocks.resolve.mockRejectedValue(outage);

    await expect(engine().resolve_remote_dependencies([dependency])).rejects.toBe(outage);
  });

  it('lets the failBuild option override ZE_FAIL_BUILD in both directions', async () => {
    const outage = unreachable();
    mocks.resolve.mockRejectedValue(outage);

    await expect(
      engine().resolve_remote_dependencies([dependency], 'var', { failBuild: true })
    ).rejects.toBe(outage);

    process.env['ZE_FAIL_BUILD'] = 'true';
    await expect(
      engine().resolve_remote_dependencies([dependency], 'var', { failBuild: false })
    ).resolves.toEqual([]);
  });

  it('still skips a remote that does not exist when ZE_FAIL_BUILD=true', async () => {
    process.env['ZE_FAIL_BUILD'] = 'true';
    mocks.resolve.mockRejectedValue(
      new ZephyrError(ZeErrors.ERR_RESOLVE_REMOTES, {
        appUid: 'remote.p.o',
        appName: 'remote',
        projectName: 'p',
        orgName: 'o',
        version: '1.0.0',
      })
    );

    await expect(engine().resolve_remote_dependencies([dependency])).resolves.toEqual([]);
  });
});
