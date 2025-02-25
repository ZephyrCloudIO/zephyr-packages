import { bench, describe } from 'vitest';
import { ZeRepackPlugin } from '../../libs/zephyr-repack-plugin/src/lib/ze-repack-plugin';

describe('ZeRepackPlugin Performance', () => {
  bench('Constructor initialization', () => {
    const zephyrEngine = { buildProperties: {} };
    new ZeRepackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
      target: 'ios',
    });
  });

  bench('Plugin apply method', () => {
    const zephyrEngine = { buildProperties: {} };
    const plugin = new ZeRepackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
      target: 'ios',
    });

    const mockCompiler = {
      hooks: {
        beforeCompile: { tap: () => {} },
        thisCompilation: { tap: () => {} },
      },
      outputPath: '/mock/output/path',
    };

    plugin.apply(mockCompiler);
  });

  bench('Constructor with android target', () => {
    const zephyrEngine = { buildProperties: {} };
    new ZeRepackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
      target: 'android',
    });
  });
});
