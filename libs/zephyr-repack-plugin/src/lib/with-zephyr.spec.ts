import * as path from 'node:path';
import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Configuration } from '@rspack/core';

const mocks = rs.hoisted(() => {
  const engine = {
    env: { target: 'ios' },
    hasActiveBuild: true,
    application_uid: 'host.project.org',
    build_failed: rs.fn(),
    resolve_remote_dependencies: rs.fn().mockResolvedValue([]),
  };

  return {
    engine,
    create: rs.fn(async () => engine),
    handleGlobalError: rs.fn(),
    collectZEPublicVars: rs.fn(() => ({ ZE_PUBLIC_API: 'https://build.example' })),
    logFn: rs.fn(),
    extractFederatedConfig: rs.fn((plugin: unknown) => plugin),
    extractFederatedDependencyPairs: rs.fn().mockReturnValue([]),
    extractLibraryType: rs.fn(),
    makeCopyOfModuleFederationOptions: rs.fn(),
    mutWebpackFederatedRemotesConfig: rs.fn(),
    writeSeed: rs
      .fn()
      .mockReturnValue('/repo/node_modules/.zephyr-repack/remote-uids-abc.js'),
    configureRuntimePlugin: rs.fn(),
    isModuleFederationPlugin: rs.fn(
      (plugin: { isMf?: boolean } | undefined) => plugin?.isMf === true
    ),
    verifyMfConfig: rs.fn().mockResolvedValue(undefined),
    plugin: rs.fn(),
  };
});

rs.mock('zephyr-agent', () => ({
  handleGlobalError: mocks.handleGlobalError,
  collectZEPublicVars: mocks.collectZEPublicVars,
  logFn: mocks.logFn,
  writeNativeRemoteUidsPlugin: mocks.writeSeed,
  ZephyrEngine: { create: mocks.create },
  ze_log: {
    init: rs.fn(),
    remotes: rs.fn(),
    app: rs.fn(),
  },
}));

rs.mock('zephyr-xpack-internal', () => ({
  configureZephyrRuntimePlugin: mocks.configureRuntimePlugin,
  extractFederatedConfig: mocks.extractFederatedConfig,
  extractFederatedDependencyPairs: mocks.extractFederatedDependencyPairs,
  extractLibraryType: mocks.extractLibraryType,
  isModuleFederationPlugin: mocks.isModuleFederationPlugin,
  makeCopyOfModuleFederationOptions: mocks.makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig: mocks.mutWebpackFederatedRemotesConfig,
}));

rs.mock('./utils/ze-util-verification', () => ({
  verify_mf_fastly_config: mocks.verifyMfConfig,
}));

rs.mock('./ze-repack-plugin', () => ({
  ZeRepackPlugin: mocks.plugin,
}));

import { withZephyr } from './with-zephyr';

describe('Re.Pack native target boundaries', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.engine.env.target = 'ios';
    mocks.engine.hasActiveBuild = true;
    mocks.engine.resolve_remote_dependencies.mockResolvedValue([]);
  });

  it('rejects an explicit tap-app target before configuring Re.Pack', () => {
    expect(() => withZephyr({ target: 'tap-app' } as never)).toThrow(
      'Re.Pack cannot publish tap-app artifacts.'
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects a tap-app platform before invoking user config or creating an engine', async () => {
    const configFn = rs.fn(() => ({ context: '/repo' }) as Configuration);
    const configure = withZephyr()(configFn);

    await expect(
      configure({ platform: 'tap-app' as never, mode: 'production' })
    ).rejects.toThrow('Re.Pack cannot publish tap-app artifacts.');

    expect(configFn).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('keeps native targets and passes them to the engine', async () => {
    const config = { context: '/repo', plugins: [] } as Configuration;
    const configure = withZephyr()(() => config);

    await expect(configure({ platform: 'android', mode: 'production' })).resolves.toBe(
      config
    );

    expect(mocks.create).toHaveBeenCalledWith({
      builder: 'repack',
      context: '/repo',
    });
    expect(mocks.engine.env.target).toBe('android');
    expect(mocks.handleGlobalError).not.toHaveBeenCalled();
  });

  it('prepends the env-native pre-loader scoped to the application UID', async () => {
    const config = {
      context: '/repo',
      plugins: [],
      module: { rules: [{ test: /\.js$/ }] },
    } as Configuration;
    await withZephyr()(() => config)({ platform: 'ios', mode: 'production' });

    expect(mocks.handleGlobalError).not.toHaveBeenCalled();
    expect(config.module?.rules).toHaveLength(2);
    expect(config.module?.rules?.[0]).toMatchObject({
      enforce: 'pre',
      exclude: /node_modules/,
      use: [
        {
          loader: expect.stringMatching(/env-native-loader\.js$/),
          options: {
            applicationUid: 'host.project.org',
            buildEnv: { ZE_PUBLIC_API: 'https://build.example' },
          },
        },
      ],
    });
  });

  it('warns when remotes are consumed without the native-cache runtime plugin', async () => {
    mocks.makeCopyOfModuleFederationOptions.mockReturnValue([
      { remotes: { mini: 'mini@http://x/mini.container.js.bundle' } },
    ]);
    await withZephyr()(() => ({ context: '/repo', plugins: [] }) as Configuration)({
      platform: 'ios',
      mode: 'production',
    });

    expect(mocks.handleGlobalError).not.toHaveBeenCalled();
    expect(mocks.logFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining("require.resolve('zephyr-native-cache/runtime-plugin')")
    );
  });
  it('registers resolved remote UIDs on Module Federation plugins with remotes', async () => {
    const mfPlugin = { isMf: true, remotes: { mini: 'mini@x' } };
    const otherMf = { isMf: true, remotes: {} };
    const config = { context: '/repo', plugins: [mfPlugin, otherMf] } as Configuration;
    mocks.engine.resolve_remote_dependencies.mockResolvedValueOnce([
      {
        name: 'mini',
        application_uid: 'mini.p.o',
        version: '*',
        default_url: '',
        remote_entry_url: '',
        library_type: 'var',
      },
    ]);

    await withZephyr()(() => config)({ platform: 'ios', mode: 'production' });

    expect(mocks.writeSeed).toHaveBeenCalledWith(
      path.join('/repo', 'node_modules', '.zephyr-repack'),
      { mini: 'mini.p.o' }
    );
    expect(mocks.configureRuntimePlugin).toHaveBeenCalledTimes(1);
    expect(mocks.configureRuntimePlugin).toHaveBeenCalledWith(
      mfPlugin,
      '/repo/node_modules/.zephyr-repack/remote-uids-abc.js'
    );
  });

  it('does not warn when the native-cache runtime plugin is configured', async () => {
    mocks.makeCopyOfModuleFederationOptions.mockReturnValue([
      {
        remotes: { mini: 'mini@http://x/mini.container.js.bundle' },
        runtimePlugins: ['/node_modules/zephyr-native-cache/src/runtime-plugin.ts'],
      },
    ]);
    await withZephyr()(() => ({ context: '/repo', plugins: [] }) as Configuration)({
      platform: 'ios',
      mode: 'production',
    });

    expect(mocks.handleGlobalError).not.toHaveBeenCalled();
    expect(mocks.logFn).not.toHaveBeenCalled();
  });
});
