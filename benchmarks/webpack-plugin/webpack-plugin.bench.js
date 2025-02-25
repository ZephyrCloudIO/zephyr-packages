import { bench, describe } from 'vitest';
import { ZeWebpackPlugin } from '../../libs/zephyr-webpack-plugin/src/webpack-plugin/ze-webpack-plugin';
import { withZephyr } from '../../libs/zephyr-webpack-plugin/src/webpack-plugin/with-zephyr';

describe('ZeWebpackPlugin Performance', () => {
  bench('Constructor initialization', () => {
    const zephyrEngine = { buildProperties: {} };
    new ZeWebpackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
    });
  });

  bench('Plugin apply method', () => {
    const zephyrEngine = { buildProperties: {} };
    const plugin = new ZeWebpackPlugin({
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
