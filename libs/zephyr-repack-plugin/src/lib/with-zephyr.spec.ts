import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Configuration } from '@rspack/core';
import * as actualNativeInternal from 'zephyr-native-internal' with {
  rstest: 'importActual',
};

const mocks = rs.hoisted(() => {
  const engine = {
    env: { target: 'ios' },
    hasActiveBuild: true,
    application_uid: 'host.project.org',
    build_failed: rs.fn(),
    resolve_remote_dependencies: rs.fn().mockResolvedValue([]),
    resolve_runtime_manifest_url: rs
      .fn()
      .mockResolvedValue('https://production-ios-host.example/zephyr-manifest.json'),
  };

  return {
    engine,
    create: rs.fn(async () => engine),
    handleGlobalError: rs.fn(),
    collectZEPublicVars: rs.fn(() => ({ ZE_PUBLIC_API: 'https://build.example' })),
    extractFederatedConfig: rs.fn((plugin: unknown) => plugin),
    extractFederatedDependencyPairs: rs.fn().mockReturnValue([]),
    extractLibraryType: rs.fn(),
    makeCopyOfModuleFederationOptions: rs.fn(),
    mutWebpackFederatedRemotesConfig: rs.fn(),
    writeEnvPlugin: rs
      .fn()
      .mockReturnValue('/repo/node_modules/.zephyr-repack/env-plugin-abc.js'),
    configureRuntimePlugin: rs.fn(),
    isModuleFederationPlugin: rs.fn(
      (plugin: { isMf?: boolean } | undefined) => plugin?.isMf === true
    ),
    verifyMfConfig: rs.fn().mockResolvedValue(undefined),
    plugin: rs.fn(),
    disableZephyrForXpack: rs.fn((config: unknown) => config),
  };
});

rs.mock('zephyr-agent', () => ({
  isZephyrDisabled: () => process.env['ZE_DISABLED'] === 'true',
  handleGlobalError: mocks.handleGlobalError,
  collectZEPublicVars: mocks.collectZEPublicVars,
  ZephyrEngine: { create: mocks.create },
  ze_log: {
    init: rs.fn(),
    remotes: rs.fn(),
    app: rs.fn(),
  },
}));

rs.mock('zephyr-native-internal', () => ({
  ...actualNativeInternal,
  writeNativeEnvRuntimePlugin: mocks.writeEnvPlugin,
}));

rs.mock('zephyr-xpack-internal', () => ({
  configureZephyrRuntimePlugin: mocks.configureRuntimePlugin,
  disableZephyrForXpack: mocks.disableZephyrForXpack,
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

    expect(mocks.writeEnvPlugin).toHaveBeenCalledWith(
      path.join('/repo', 'node_modules', '.zephyr-repack'),
      [
        {
          name: 'mini',
          application_uid: 'mini.p.o',
          version: '*',
          default_url: '',
          remote_entry_url: '',
          library_type: 'var',
        },
      ],
      undefined
    );
    expect(mocks.configureRuntimePlugin).toHaveBeenCalledTimes(1);
    expect(mocks.configureRuntimePlugin).toHaveBeenCalledWith(
      mfPlugin,
      '/repo/node_modules/.zephyr-repack/env-plugin-abc.js'
    );
  });

  it('binds the runtimeManifest root to each Module Federation plugin with remotes', async () => {
    const mfPlugin = { isMf: true, name: 'shell', remotes: { host: 'host@x' } };
    const config = { context: '/repo', plugins: [mfPlugin] } as Configuration;

    await withZephyr({ runtimeManifest: '@production-${target}' })(() => config)({
      platform: 'ios',
      mode: 'production',
    });

    expect(mocks.handleGlobalError).not.toHaveBeenCalled();
    expect(mocks.engine.resolve_runtime_manifest_url).toHaveBeenCalledWith(
      '@production-${target}'
    );
    expect(mocks.writeEnvPlugin).toHaveBeenCalledWith(expect.any(String), [], {
      name: 'shell',
      applicationUid: 'host.project.org',
      manifestUrl: 'https://production-ios-host.example/zephyr-manifest.json',
    });
    expect(mocks.configureRuntimePlugin).toHaveBeenCalledWith(
      mfPlugin,
      '/repo/node_modules/.zephyr-repack/env-plugin-abc.js'
    );
  });

  describe('ZE_DISABLED=true', () => {
    afterEach(() => {
      delete process.env['ZE_DISABLED'];
    });

    it('builds the user config with the skip plugin and never creates an engine', async () => {
      process.env['ZE_DISABLED'] = 'true';
      const config = { context: '/repo', plugins: [] } as Configuration;
      const configFn = rs.fn(() => config);

      const result = await withZephyr()(configFn)({
        platform: 'ios',
        mode: 'production',
      });

      expect(configFn).toHaveBeenCalledWith({ platform: 'ios', mode: 'production' });
      expect(result).toBe(config);
      expect(mocks.disableZephyrForXpack).toHaveBeenCalledWith(config);
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.plugin).not.toHaveBeenCalled();
    });

    it('still rejects a tap-app platform first', async () => {
      process.env['ZE_DISABLED'] = 'true';
      const configFn = rs.fn(() => ({ context: '/repo' }) as Configuration);

      await expect(
        withZephyr()(configFn)({ platform: 'tap-app' as never, mode: 'production' })
      ).rejects.toThrow('Re.Pack cannot publish tap-app artifacts.');
      expect(configFn).not.toHaveBeenCalled();
    });

    it('does not skip Zephyr for other values', async () => {
      process.env['ZE_DISABLED'] = '1';

      await withZephyr()(() => ({ context: '/repo', plugins: [] }) as Configuration)({
        platform: 'android',
        mode: 'production',
      });

      expect(mocks.disableZephyrForXpack).not.toHaveBeenCalled();
      expect(mocks.create).toHaveBeenCalledTimes(1);
    });
  });
});
