import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const { hostFunc, remoteFunc, zephyrMetroReactNativeCli } = rs.hoisted(() => ({
  hostFunc: rs.fn(),
  remoteFunc: rs.fn(),
  zephyrMetroReactNativeCli: rs.fn(),
}));

rs.mock('../zephyr-metro-react-native-cli', () => ({
  zephyrMetroReactNativeCli,
}));

import { zephyrMetroRNEFPlugin } from '../zephyr-metro-rnef-plugin';

describe('zephyrMetroRNEFPlugin', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    zephyrMetroReactNativeCli.mockReturnValue({
      commands: [
        {
          name: 'bundle-mf-host',
          description: 'host',
          func: hostFunc,
          options: [{ name: '--host', description: 'host option' }],
        },
        {
          name: 'bundle-mf-remote',
          description: 'remote',
          func: remoteFunc,
          options: [{ name: '--remote', description: 'remote option' }],
        },
      ],
    });
  });

  it('keeps registering both adapter commands with the RNEF API', async () => {
    const registered: any[] = [];
    const api = {
      registerCommand: (command: any) => registered.push(command),
      getProjectRoot: () => '/app',
      getPlatforms: () => ({ ios: {} }),
      getReactNativePath: () => '/app/node_modules/react-native',
    };

    const plugin = zephyrMetroRNEFPlugin({ platforms: { custom: {} } })(api);
    const args = { platform: 'ios', mode: 'production' };
    await registered[0].action(args);

    expect(plugin.name).toBe('zephyr-metro-rnef-plugin');
    expect(registered.map(({ name }) => name)).toEqual([
      'bundle-mf-host',
      'bundle-mf-remote',
    ]);
    expect(hostFunc).toHaveBeenCalledWith(
      [],
      {
        root: '/app',
        reactNativePath: '/app/node_modules/react-native',
        platforms: { custom: {} },
      },
      args
    );
  });
});
