import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import * as actualResolver from '../resolve_remote_dependency' with {
  rstest: 'importActual',
};

import { getRequestIdentity } from '../../lib/http/request-identity';
import { ZephyrEngine } from '../index';

const mocks = rs.hoisted(() => ({
  resolve: rs.fn(),
}));

rs.mock('../resolve_remote_dependency', () => ({
  ...actualResolver,
  resolve_remote_dependency: mocks.resolve,
}));

rs.mock('../../lib/logging/ze-log-event', () => ({
  formatLogMsg: rs.fn((message: string) => message),
  logFn: rs.fn(),
  logger: rs.fn(),
}));

function engine(): ZephyrEngine {
  const value = Object.create(ZephyrEngine.prototype) as ZephyrEngine;
  value.application_configuration = Promise.resolve({ username: 'dev' } as never);
  value.gitProperties = {
    app: { org: 'org', project: 'project' },
    git: { branch: 'main' },
  } as never;
  value.npmProperties = {} as never;
  value.zephyrConfig = {};
  value.env = { isCI: false, target: 'ios', ssr: false };
  return value;
}

describe('ZephyrEngine.resolve_remote_dependencies ${target} selectors', () => {
  beforeEach(() => {
    mocks.resolve.mockReset();
    // The resolver echoes the requested selector as `version`.
    mocks.resolve.mockImplementation(async ({ version }: { version: string }) => ({
      name: 'remote.project.org',
      version,
      application_uid: 'remote.project.org',
      default_url: 'https://dev-ios-remote.example',
      remote_entry_url: 'https://dev-ios-remote.example/remoteEntry.js',
      library_type: 'var',
    }));
  });

  it('requests the expanded selector and reports the declared one', async () => {
    const [resolved] =
      (await engine().resolve_remote_dependencies([
        { name: 'remote.project.org', version: 'dev-${target}' },
      ])) ?? [];

    expect(mocks.resolve).toHaveBeenCalledWith(
      expect.objectContaining({ version: 'dev-ios', platform: 'ios' })
    );
    // Metro and xpack match resolved remotes to their declaration by this selector.
    expect(resolved?.version).toBe('dev-${target}');
    expect(resolved?.remote_entry_url).toBe(
      'https://dev-ios-remote.example/remoteEntry.js'
    );
  });

  it('reports the declared selector for aliased remotes', async () => {
    const [resolved] =
      (await engine().resolve_remote_dependencies([
        { name: 'remote', version: 'dev-${target}' },
      ])) ?? [];

    expect(resolved).toMatchObject({ name: 'remote', version: 'dev-${target}' });
  });
});

describe('ZephyrEngine.resolve_remote_dependencies request identity', () => {
  let identities: Array<ReturnType<typeof getRequestIdentity>>;

  beforeEach(() => {
    identities = [];
    mocks.resolve.mockReset();
    mocks.resolve.mockImplementation(async () => {
      identities.push(getRequestIdentity());
      return {
        name: 'remote.project.org',
        version: 'latest',
        application_uid: 'remote.project.org',
        default_url: 'https://remote.example',
        remote_entry_url: 'https://remote.example/remoteEntry.js',
        library_type: 'var',
      };
    });
  });

  function identifiedEngine(build_id: Promise<string>): ZephyrEngine {
    const value = engine();
    value.builder = 'webpack';
    value.plugin_identity = { name: 'zephyr-webpack-plugin', version: '1.8.0' };
    value.build_id = build_id;
    return value;
  }

  it('does not wait for a build ID that is still being fetched', async () => {
    // The build-ID request is still in flight when the plugin resolves remotes.
    const resolved = await identifiedEngine(
      new Promise<string>(() => undefined)
    ).resolve_remote_dependencies([{ name: 'remote.project.org', version: 'latest' }]);

    expect(resolved).toHaveLength(1);
    expect(identities).toEqual([
      expect.objectContaining({
        buildId: undefined,
        builder: 'webpack',
        plugin: 'zephyr-webpack-plugin',
      }),
    ]);
  });

  it('attaches the build ID once it is known', async () => {
    const build_id = Promise.resolve('11887');
    await build_id;

    await identifiedEngine(build_id).resolve_remote_dependencies([
      { name: 'remote.project.org', version: 'latest' },
    ]);

    expect(identities).toEqual([expect.objectContaining({ buildId: '11887' })]);
  });

  it('resolves without a build ID when its fetch failed', async () => {
    const build_id = Promise.reject(new Error('build ID unavailable'));
    build_id.catch(() => undefined);

    const resolved = await identifiedEngine(build_id).resolve_remote_dependencies([
      { name: 'remote.project.org', version: 'latest' },
    ]);

    expect(resolved).toHaveLength(1);
    expect(identities).toEqual([expect.objectContaining({ buildId: undefined })]);
  });
});
