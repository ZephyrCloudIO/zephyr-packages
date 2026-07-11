import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { ZeResolvedDependency } from 'zephyr-agent';
import type { Configuration } from './with-zephyr';

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
  getGlobal: mocks.getGlobal,
  handleGlobalError: mocks.handleGlobalError,
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

rs.mock('./ze-rspack-plugin', () => ({
  ZeRspackPlugin: class ZeRspackPlugin {
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

describe('Rspack withZephyr compiler arrays', () => {
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
      // Match ZephyrEngine's stateful API: each call replaces this field.
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
    ] as unknown as Configuration[];

    mocks.engine.resolve_remote_dependencies.mockImplementation(async (pairs) => {
      expect(mocks.engine.env.target).toBe('tap-app');
      const resolved = [dependency(pairs[0].name)];
      mocks.engine.federated_dependencies = resolved;
      return resolved;
    });

    const result = await withZephyr({ target: 'tap-app' })(configs);

    expect(result).toBe(configs);
    expect(configs[0]?.plugins).toHaveLength(1);
    expect(configs[1]?.plugins).toHaveLength(1);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.engine.env.target).toBe('tap-app');
    expect(mocks.mutPathModePublicPath).toHaveBeenCalledTimes(2);
    expect(mocks.engine.federated_dependencies?.map(({ name }) => name)).toEqual([
      'client',
      'server',
    ]);
  });

  it('rejects coordinated configuration errors instead of waiting for a missing compiler', async () => {
    const configs = [
      { name: 'client', context: '/repo' },
      { name: 'broken', context: '/repo' },
    ] as unknown as Configuration[];

    await expect(withZephyr()(configs)).rejects.toThrow('invalid federation config');
    expect(mocks.handleGlobalError).not.toHaveBeenCalled();
    expect(mocks.engine.build_failed).toHaveBeenCalledTimes(1);
  });

  it('rolls back direct configuration errors before preserving fail-open semantics', async () => {
    const config = { name: 'broken', context: '/repo' } as unknown as Configuration;

    await expect(withZephyr()(config)).resolves.toBe(config);

    expect(mocks.engine.build_failed).toHaveBeenCalledTimes(1);
    expect(mocks.handleGlobalError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'invalid federation config' })
    );
  });
});
