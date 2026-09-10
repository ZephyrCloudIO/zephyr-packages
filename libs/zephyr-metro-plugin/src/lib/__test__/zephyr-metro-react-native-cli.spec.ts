import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const { runtimeRequire, wrappedCommand, zephyrCommandWrapper } = rs.hoisted(() => ({
  runtimeRequire: rs.fn(),
  wrappedCommand: rs.fn(),
  zephyrCommandWrapper: rs.fn(),
}));

rs.mock('node:module', () => ({
  createRequire: () => runtimeRequire,
}));

rs.mock('../zephyr-metro-command-wrapper', () => ({
  zephyrCommandWrapper,
}));

rs.mock('zephyr-agent', () => ({
  ZephyrError: Error,
  ZeErrors: { ERR_UNKNOWN: 'ERR_UNKNOWN' },
}));

import { zephyrMetroReactNativeCli } from '../zephyr-metro-react-native-cli';

describe('zephyrMetroReactNativeCli', () => {
  const updateManifest = rs.fn();
  const bundleFederatedHost = rs.fn();
  const bundleFederatedRemote = rs.fn();
  const loadMetroConfig = rs.fn();

  beforeEach(() => {
    rs.clearAllMocks();
    runtimeRequire.mockImplementation((request: string) => {
      if (request === '@module-federation/metro') {
        return { updateManifest };
      }
      if (request === '@module-federation/metro/commands') {
        return {
          default: {
            bundleFederatedHost,
            bundleFederatedHostOptions: [{ name: '--host-option' }],
            bundleFederatedRemote,
            bundleFederatedRemoteOptions: [{ name: '--remote-option' }],
            loadMetroConfig,
          },
        };
      }
      throw new Error(`Unexpected request: ${request}`);
    });
    wrappedCommand.mockResolvedValue(undefined);
    zephyrCommandWrapper.mockResolvedValue(wrappedCommand);
  });

  it('registers host and remote commands with the upstream options', () => {
    const adapter = zephyrMetroReactNativeCli({ projectRoot: '/app' });

    expect(adapter.commands.map(({ name }) => name)).toEqual([
      'bundle-mf-host',
      'bundle-mf-remote',
    ]);
    expect(adapter.commands[0]?.options).toEqual([
      { name: '--host-option' },
      expect.objectContaining({ name: '--config-cmd [string]' }),
    ]);
    expect(adapter.commands[1]?.options).toEqual([{ name: '--remote-option' }]);
  });

  it('uses the existing Metro command wrapper and manifest globals', async () => {
    const command = zephyrMetroReactNativeCli().commands[1]!;
    const config = {
      root: '/app',
      platforms: {},
      reactNativePath: '/app/node_modules/react-native',
    };
    const args = { mode: 'production', platform: 'ios' };
    (globalThis as any).__METRO_FEDERATION_MANIFEST_PATH = '/app/manifest.json';
    (globalThis as any).__METRO_FEDERATION_CONFIG = { name: 'remote' };

    await command.func([], config, args);
    const updateManifestCallback = zephyrCommandWrapper.mock.calls[0]?.[2];
    updateManifestCallback();

    expect(zephyrCommandWrapper).toHaveBeenCalledWith(
      bundleFederatedRemote,
      loadMetroConfig,
      expect.any(Function)
    );
    expect(wrappedCommand).toHaveBeenCalledWith([args], config, args);
    expect(updateManifest).toHaveBeenCalledWith('/app/manifest.json', {
      name: 'remote',
    });
  });

  for (const dev of [true, false]) {
    it(`passes dev=${dev} to the wrapper without synthesizing mode`, async () => {
      const command = zephyrMetroReactNativeCli().commands[1]!;
      const config = {
        root: '/app',
        platforms: {},
        reactNativePath: '/app/node_modules/react-native',
      };
      const args = { dev, platform: 'android' };

      await command.func([], config, args);

      expect(wrappedCommand).toHaveBeenCalledWith([args], config, args);
      expect(args).not.toHaveProperty('mode');
    });
  }

  it('prints success only after publication completes', async () => {
    let completePublication!: () => void;
    wrappedCommand.mockImplementation(
      () => new Promise<void>((resolve) => (completePublication = resolve))
    );
    const info = rs.spyOn(console, 'info').mockImplementation(() => undefined);
    const command = zephyrMetroReactNativeCli().commands[0]!;

    const publication = command.func(
      [],
      { root: '/app', platforms: {}, reactNativePath: '/react-native' },
      { platform: 'android' }
    );
    await Promise.resolve();

    expect(info).not.toHaveBeenCalledWith('Success.');
    completePublication();
    await publication;
    expect(info).toHaveBeenLastCalledWith('Success.');
  });

  it('does not print success when publication fails', async () => {
    wrappedCommand.mockRejectedValue(new Error('upload failed'));
    const info = rs.spyOn(console, 'info').mockImplementation(() => undefined);
    const command = zephyrMetroReactNativeCli().commands[0]!;

    await expect(
      command.func(
        [],
        { root: '/app', platforms: {}, reactNativePath: '/react-native' },
        { platform: 'android' }
      )
    ).rejects.toThrow('upload failed');
    expect(info).not.toHaveBeenCalledWith('Success.');
  });
});
