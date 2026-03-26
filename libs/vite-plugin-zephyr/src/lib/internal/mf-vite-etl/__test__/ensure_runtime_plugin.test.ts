import { ensureRuntimePlugin } from '../ensure_runtime_plugin';

describe('ensureRuntimePlugin', () => {
  test('adds the zephyr runtime plugin when missing', () => {
    const mfConfig = ensureRuntimePlugin({
      name: 'host',
    });

    expect(mfConfig.runtimePlugins).toEqual(
      expect.arrayContaining(['virtual:zephyr-mf-runtime-plugin'])
    );
  });

  test('does not duplicate the zephyr runtime plugin', () => {
    const first = ensureRuntimePlugin({
      name: 'host',
    });
    const second = ensureRuntimePlugin(first);
    const matches = second.runtimePlugins?.filter(
      (plugin) => plugin === 'virtual:zephyr-mf-runtime-plugin'
    );

    expect(matches).toHaveLength(1);
  });
});
