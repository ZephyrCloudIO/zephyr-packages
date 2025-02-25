import { bench, describe } from 'vitest';
import { ZeRspackPlugin } from '../../libs/zephyr-rspack-plugin/src/rspack-plugin/ze-rspack-plugin';
import { withZephyr } from '../../libs/zephyr-rspack-plugin/src/rspack-plugin/with-zephyr';

describe('ZeRspackPlugin Performance', () => {
  bench('Constructor initialization', () => {
    const zephyrEngine = { buildProperties: {} };
    new ZeRspackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
    });
  });

  bench('Plugin apply method', () => {
    const zephyrEngine = { buildProperties: {} };
    const plugin = new ZeRspackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
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
});

describe('withZephyr Performance', () => {
  // Testing just the function call, not the async operation
  bench('Function call', () => {
    withZephyr();
  });

  bench('Function with options', () => {
    withZephyr({ wait_for_index_html: true });
  });
});
