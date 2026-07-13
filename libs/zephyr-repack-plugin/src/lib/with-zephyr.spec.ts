import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Configuration } from '@rspack/core';

const mocks = rs.hoisted(() => {
  const engine = {
    env: { target: 'ios' },
    hasActiveBuild: true,
    build_failed: rs.fn(),
    resolve_remote_dependencies: rs.fn().mockResolvedValue([]),
  };

  return {
    engine,
    create: rs.fn(async () => engine),
    handleGlobalError: rs.fn(),
    extractFederatedDependencyPairs: rs.fn().mockReturnValue([]),
    extractLibraryType: rs.fn(),
    makeCopyOfModuleFederationOptions: rs.fn(),
    mutWebpackFederatedRemotesConfig: rs.fn(),
    verifyMfConfig: rs.fn().mockResolvedValue(undefined),
    plugin: rs.fn(),
  };
});

rs.mock('zephyr-agent', () => ({
  handleGlobalError: mocks.handleGlobalError,
  ZephyrEngine: { create: mocks.create },
  ze_log: {
    init: rs.fn(),
    remotes: rs.fn(),
    app: rs.fn(),
  },
}));

rs.mock('zephyr-xpack-internal', () => ({
  extractFederatedDependencyPairs: mocks.extractFederatedDependencyPairs,
  extractLibraryType: mocks.extractLibraryType,
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
  });
});
