import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Configuration } from 'webpack';
import type { ZeResolvedDependency } from 'zephyr-agent';

const mocks = rs.hoisted(() => {
  const engine = {
    env: { target: 'web' },
    federated_dependencies: null as ZeResolvedDependency[] | null,
    resolve_remote_dependencies: rs.fn(),
    build_id: Promise.resolve('build-1'),
    hasActiveBuild: true,
    build_failed: rs.fn(),
  };
  return {
    engine,
    assertBuildTarget: rs.fn((value: unknown, optionName = 'target') => {
      if (!['web', 'ios', 'android', 'tap-app'].includes(value as string)) {
        throw new TypeError(`${optionName} must be one of web, ios, android, tap-app`);
      }
    }),
    create: rs.fn(async () => engine),
    getGlobal: rs.fn(() => ({})),
    handleGlobalError: rs.fn(),
    extractFederatedDependencyPairs: rs.fn(),
    extractLibraryType: rs.fn(() => 'module'),
    mutWebpackFederatedRemotesConfig: rs.fn(),
    mutPathModePublicPath: rs.fn(),
    makeCopyOfModuleFederationOptions: rs.fn(),
    coordinateXPackCompilers: rs.fn(),
  };
});

rs.mock('zephyr-agent', () => ({
  assertZephyrBuildTarget: mocks.assertBuildTarget,
  getGlobal: mocks.getGlobal,
  handleGlobalError: mocks.handleGlobalError,
  ze_log: { mf: rs.fn() },
  ZephyrEngine: { create: mocks.create },
}));

rs.mock('zephyr-xpack-internal', () => ({
  extractFederatedDependencyPairs: mocks.extractFederatedDependencyPairs,
  extractLibraryType: mocks.extractLibraryType,
  mutWebpackFederatedRemotesConfig: mocks.mutWebpackFederatedRemotesConfig,
  mutPathModePublicPath: mocks.mutPathModePublicPath,
  makeCopyOfModuleFederationOptions: mocks.makeCopyOfModuleFederationOptions,
  coordinateXPackCompilers: mocks.coordinateXPackCompilers,
}));

rs.mock('./ze-webpack-plugin', () => ({
  ZeWebpackPlugin: class ZeWebpackPlugin {
    constructor(readonly options: unknown) {}
  },
}));

import { withZephyr } from './with-zephyr';

function dependency(name: string): ZeResolvedDependency {
  return {
    name,
    version: '1.0.0',
    application_uid: `org.project.${name}`,
    default_url: `https://example.test/${name}`,
    remote_entry_url: `https://example.test/${name}/remoteEntry.js`,
    library_type: 'module',
  };
}

describe('Webpack withZephyr compiler arrays', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.engine.env.target = 'web';
    mocks.engine.federated_dependencies = null;
    mocks.extractFederatedDependencyPairs.mockImplementation((config) => {
      if (config.name === 'broken') throw new Error('invalid federation config');
      return [{ name: config.name }];
    });
    mocks.engine.resolve_remote_dependencies.mockImplementation(async (pairs) => {
      const resolved = [dependency(pairs[0].name)];
      mocks.engine.federated_dependencies = resolved;
      return resolved;
    });
    mocks.coordinateXPackCompilers.mockImplementation((_engine, configs) => ({
      coordinator: { coordinated: true },
      compilers: configs.map((config: { name?: string }, index: number) => ({
        participant: config.name ?? `compiler-${index}`,
        assetPrefix: config.name,
      })),
    }));
  });

  it('initializes missing plugin arrays and preserves remotes from every compiler', async () => {
    const configs = [
      { name: 'client', context: '/repo', output: { path: '/repo/dist/client' } },
      { name: 'server', context: '/repo', output: { path: '/repo/dist/server' } },
    ] as Configuration[];

    const result = await withZephyr()(configs);

    expect(result).toBe(configs);
    expect(configs[0]?.plugins).toHaveLength(1);
    expect(configs[1]?.plugins).toHaveLength(1);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.mutPathModePublicPath).toHaveBeenCalledTimes(2);
    expect(mocks.engine.federated_dependencies?.map(({ name }) => name)).toEqual([
      'client',
      'server',
    ]);
  });

  it('sets tap-app before resolving a direct Webpack build', async () => {
    const config = { name: 'client', context: '/repo' } as Configuration;

    await withZephyr({ target: 'tap-app' })(config);

    expect(mocks.create).toHaveBeenCalledWith({
      builder: 'webpack',
      context: '/repo',
      target: 'tap-app',
    });
    expect(mocks.engine.env.target).toBe('tap-app');
  });

  it('rejects unsupported targets before creating an engine', () => {
    expect(() => withZephyr({ target: 'desktop' as never })).toThrow(
      'withZephyr({ target }) must be one of'
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects coordinated configuration errors instead of waiting for a missing compiler', async () => {
    const configs = [
      { name: 'client', context: '/repo' },
      { name: 'broken', context: '/repo' },
    ] as Configuration[];

    await expect(withZephyr()(configs)).rejects.toThrow('invalid federation config');
    expect(mocks.handleGlobalError).not.toHaveBeenCalled();
    expect(mocks.engine.build_failed).toHaveBeenCalledTimes(1);
  });

  it('rolls back direct configuration errors before preserving fail-open semantics', async () => {
    const config = { name: 'broken', context: '/repo' } as Configuration;

    await expect(withZephyr()(config)).resolves.toBe(config);

    expect(mocks.engine.build_failed).toHaveBeenCalledTimes(1);
    expect(mocks.handleGlobalError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'invalid federation config' })
    );
  });
});
