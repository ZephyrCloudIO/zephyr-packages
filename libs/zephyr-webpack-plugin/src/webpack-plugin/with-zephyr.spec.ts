import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
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
    handleGlobalError: rs.fn((error: unknown, options?: { failBuild?: boolean }) => {
      if (options?.failBuild ?? process.env['ZE_FAIL_BUILD'] === 'true') throw error;
    }),
    snapshotPlugins: rs.fn(() => ['snapshot']),
    restorePlugins: rs.fn(),
    isZephyrDisabled: rs.fn(() => false),
    disableZephyrForXpack: rs.fn((config: unknown) => config),
    extractFederatedDependencyPairs: rs.fn(),
    extractLibraryType: rs.fn(() => 'module'),
    mutWebpackFederatedRemotesConfig: rs.fn(),
    makeCopyOfModuleFederationOptions: rs.fn(),
    coordinateXPackCompilers: rs.fn(),
  };
});

rs.mock('zephyr-agent', () => ({
  assertZephyrBuildTarget: mocks.assertBuildTarget,
  getGlobal: mocks.getGlobal,
  isZephyrDisabled: mocks.isZephyrDisabled,
  handleGlobalError: mocks.handleGlobalError,
  ze_log: { mf: rs.fn() },
  ZephyrEngine: { create: mocks.create },
}));

rs.mock('zephyr-xpack-internal', () => ({
  disableZephyrForXpack: mocks.disableZephyrForXpack,
  extractFederatedDependencyPairs: mocks.extractFederatedDependencyPairs,
  extractLibraryType: mocks.extractLibraryType,
  mutWebpackFederatedRemotesConfig: mocks.mutWebpackFederatedRemotesConfig,
  makeCopyOfModuleFederationOptions: mocks.makeCopyOfModuleFederationOptions,
  coordinateXPackCompilers: mocks.coordinateXPackCompilers,
  snapshotPlugins: mocks.snapshotPlugins,
  restorePlugins: mocks.restorePlugins,
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

  describe('when Zephyr fails while configuring a compiler array', () => {
    const originalFailBuild = process.env['ZE_FAIL_BUILD'];

    function brokenArray(): Configuration[] {
      return [
        { name: 'client', context: '/repo' },
        { name: 'broken', context: '/repo' },
      ] as Configuration[];
    }

    afterEach(() => {
      if (originalFailBuild === undefined) delete process.env['ZE_FAIL_BUILD'];
      else process.env['ZE_FAIL_BUILD'] = originalFailBuild;
    });

    it('lets the failBuild option override ZE_FAIL_BUILD in both directions', async () => {
      delete process.env['ZE_FAIL_BUILD'];
      await expect(withZephyr({ failBuild: true })(brokenArray())).rejects.toThrow(
        'invalid federation config'
      );

      process.env['ZE_FAIL_BUILD'] = 'true';
      const configs = brokenArray();
      await expect(withZephyr({ failBuild: false })(configs)).resolves.toBe(configs);
    });

    it('fails the build when ZE_FAIL_BUILD=true', async () => {
      process.env['ZE_FAIL_BUILD'] = 'true';

      await expect(withZephyr()(brokenArray())).rejects.toThrow(
        'invalid federation config'
      );
      expect(mocks.handleGlobalError).toHaveBeenCalledTimes(1);
      expect(mocks.engine.build_failed).toHaveBeenCalledTimes(1);
    });

    it('keeps the build green without ZE_FAIL_BUILD and removes the partial plugins', async () => {
      delete process.env['ZE_FAIL_BUILD'];
      const configs = brokenArray();

      await expect(withZephyr()(configs)).resolves.toBe(configs);

      expect(mocks.handleGlobalError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'invalid federation config' }),
        { failBuild: undefined }
      );
      expect(mocks.restorePlugins).toHaveBeenCalledWith(configs, ['snapshot']);
      expect(mocks.engine.build_failed).toHaveBeenCalledTimes(1);
    });

    it('fails the build when Zephyr cannot start and ZE_FAIL_BUILD=true', async () => {
      process.env['ZE_FAIL_BUILD'] = 'true';
      const unreachable = new Error('Zephyr cannot be reached');
      mocks.create.mockRejectedValueOnce(unreachable);

      await expect(withZephyr()(brokenArray())).rejects.toBe(unreachable);
      expect(mocks.engine.build_failed).not.toHaveBeenCalled();
    });

    it('keeps the build green when Zephyr cannot start and ZE_FAIL_BUILD is unset', async () => {
      delete process.env['ZE_FAIL_BUILD'];
      const unreachable = new Error('Zephyr cannot be reached');
      mocks.create.mockRejectedValueOnce(unreachable);
      const configs = brokenArray();

      await expect(withZephyr()(configs)).resolves.toBe(configs);

      expect(mocks.handleGlobalError).toHaveBeenCalledWith(unreachable, {
        failBuild: undefined,
      });
      expect(mocks.restorePlugins).toHaveBeenCalledWith(configs, ['snapshot']);
    });
  });

  it('rolls back direct configuration errors before preserving fail-open semantics', async () => {
    const config = { name: 'broken', context: '/repo' } as Configuration;

    await expect(withZephyr()(config)).resolves.toBe(config);

    expect(mocks.engine.build_failed).toHaveBeenCalledTimes(1);
    expect(mocks.handleGlobalError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'invalid federation config' }),
      { failBuild: undefined }
    );
  });
  it('skips every Zephyr step when ZE_DISABLED is set', async () => {
    mocks.isZephyrDisabled.mockReturnValue(true);
    const configs = [
      { name: 'client', context: '/repo' },
      { name: 'server', context: '/repo' },
    ] as unknown as Configuration[];

    try {
      await expect(withZephyr()(configs)).resolves.toBe(configs);
      await expect(withZephyr()(configs[0] as Configuration)).resolves.toBe(configs[0]);
    } finally {
      mocks.isZephyrDisabled.mockReturnValue(false);
    }

    expect(mocks.disableZephyrForXpack).toHaveBeenCalledTimes(2);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.extractFederatedDependencyPairs).not.toHaveBeenCalled();
    expect(mocks.coordinateXPackCompilers).not.toHaveBeenCalled();
  });

  it('rejects direct configuration errors when failBuild is set', async () => {
    const config = { name: 'broken', context: '/repo' } as Configuration;
    mocks.handleGlobalError.mockImplementationOnce(
      (error: unknown, options?: { failBuild?: boolean }) => {
        if (options?.failBuild) throw error;
      }
    );

    await expect(withZephyr({ failBuild: true })(config)).rejects.toThrow(
      'invalid federation config'
    );
    expect(mocks.engine.build_failed).toHaveBeenCalledTimes(1);
  });
});
