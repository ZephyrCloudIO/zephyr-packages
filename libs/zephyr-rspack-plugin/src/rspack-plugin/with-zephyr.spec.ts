import { detectBaseHref } from '../../../zephyr-xpack-internal/src/basehref/basehref-integration';
import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { ZeResolvedDependency } from 'zephyr-agent';
import type { Configuration } from './with-zephyr';
import type { ZeRspackPlugin } from './ze-rspack-plugin';

const mocks = rs.hoisted(() => {
  const engine = {
    env: { target: 'web' },
    federated_dependencies: null as ZeResolvedDependency[] | null,
    resolve_remote_dependencies: rs.fn(),
    build_id: Promise.resolve('build-1'),
    hasActiveBuild: true,
    buildProperties: {},
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
    makeCopyOfModuleFederationOptions: rs.fn(),
    coordinateXPackCompilers: rs.fn(),
    registerParticipantBaseHref: rs.fn(),
  };
});

rs.mock('zephyr-agent', () => ({
  assertZephyrBuildTarget: mocks.assertBuildTarget,
  getGlobal: mocks.getGlobal,
  handleGlobalError: mocks.handleGlobalError,
  ZephyrEngine: { create: mocks.create },
}));

rs.mock('zephyr-xpack-internal', () => ({
  detectBaseHref,
  logBuildSteps: rs.fn(),
  setupManifestEmission: rs.fn(),
  setupZeDeploy: rs.fn(),
  extractFederatedDependencyPairs: mocks.extractFederatedDependencyPairs,
  extractLibraryType: mocks.extractLibraryType,
  mutWebpackFederatedRemotesConfig: mocks.mutWebpackFederatedRemotesConfig,
  makeCopyOfModuleFederationOptions: mocks.makeCopyOfModuleFederationOptions,
  coordinateXPackCompilers: mocks.coordinateXPackCompilers,
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
      coordinator: { registerParticipantBaseHref: mocks.registerParticipantBaseHref },
      compilers: configs.map((config: { name?: string }, index: number) => ({
        participant: config.name ?? `compiler-${index}`,
        role: config.name === 'server' ? 'server' : 'client',
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
    expect(mocks.engine.federated_dependencies?.map(({ name }) => name)).toEqual([
      'client',
      'server',
    ]);
  });

  it.each([
    ['/', '/bundles/', '/'],
    ['/store/bundles/', '/store/bundles/', '/store/bundles/'],
    ['https://cdn.test/store/', '/bundles/', 'https://cdn.test/store/'],
    ['auto', '/bundles/', '/'],
  ])(
    'uses the Modern.js client base %s without rewriting server public path %s',
    async (clientPath, serverPath, expected) => {
      const configs: Configuration[] = [
        { name: 'client', output: { path: '/repo/dist', publicPath: clientPath } },
        {
          name: 'server',
          target: 'node',
          output: { path: '/repo/dist/bundles', publicPath: serverPath },
        },
      ];
      await withZephyr({ __useClientBaseHref: true })(configs);
      const server = configs[1]!;
      const plugin = server.plugins![0] as ZeRspackPlugin;
      plugin.apply({
        outputPath: server.output!.path,
        options: { ...server, module: {} },
        hooks: { compilation: { tap: rs.fn() } },
      } as never);
      expect(mocks.registerParticipantBaseHref).toHaveBeenCalledExactlyOnceWith(
        'server',
        expected
      );
      expect(server.output?.publicPath).toBe(serverPath);
      expect(
        (configs[0]!.plugins![0] as ZeRspackPlugin)._options.baseHref
      ).toBeUndefined();
    }
  );

  it('preserves the client HTML base and leaves generic compiler arrays unchanged', async () => {
    class HtmlRspackPlugin {
      options = { base: '/shop/' };
    }
    const configs: Configuration[] = [
      { name: 'server', target: 'node', output: { publicPath: '/bundles/' } },
      {
        name: 'client',
        output: { publicPath: '/cdn/' },
        plugins: [new HtmlRspackPlugin() as never],
      },
    ];
    await withZephyr({ __useClientBaseHref: true })(configs);
    expect((configs[0]!.plugins![0] as ZeRspackPlugin)._options.baseHref).toBe('/shop/');
    const generic: Configuration[] = [
      { name: 'client', output: { publicPath: '/store/bundles/' } },
      { name: 'server', target: 'node', output: { publicPath: '/store/bundles/' } },
    ];
    await withZephyr()(generic);
    expect((generic[1]!.plugins![0] as ZeRspackPlugin)._options.baseHref).toBeUndefined();
    const serverOnly: Configuration[] = [
      { name: 'server', target: 'node', output: { publicPath: '/standalone/' } },
    ];
    await withZephyr({ __useClientBaseHref: true })(serverOnly);
    expect(
      (serverOnly[0]!.plugins![0] as ZeRspackPlugin)._options.baseHref
    ).toBeUndefined();
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
