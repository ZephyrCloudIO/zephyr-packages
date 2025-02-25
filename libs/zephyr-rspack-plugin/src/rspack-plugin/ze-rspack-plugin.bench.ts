import { bench, describe } from 'vitest';
import { ZeRspackPlugin } from './ze-rspack-plugin';
import { withZephyr } from './with-zephyr';

// Mock dependencies to avoid actual network calls
jest.mock('zephyr-agent', () => ({
  ZephyrEngine: {
    create: jest.fn().mockResolvedValue({
      resolve_remote_dependencies: jest.fn().mockResolvedValue([]),
      buildProperties: {},
    }),
  },
  ze_log: jest.fn(),
}));

jest.mock('zephyr-xpack-internal', () => ({
  extractFederatedDependencyPairs: jest.fn().mockReturnValue([]),
  makeCopyOfModuleFederationOptions: jest.fn().mockReturnValue({}),
  mutWebpackFederatedRemotesConfig: jest.fn(),
  logBuildSteps: jest.fn(),
  setupZeDeploy: jest.fn(),
}));

describe('ZeRspackPlugin Performance', () => {
  const mockCompiler = {
    hooks: {
      beforeCompile: { tap: jest.fn() },
      thisCompilation: { tap: jest.fn() },
    },
    outputPath: '/mock/output/path',
  };

  bench('Constructor initialization', () => {
    const zephyrEngine = { buildProperties: {} } as any;
    new ZeRspackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
    });
  });

  bench('Plugin apply method', () => {
    const zephyrEngine = { buildProperties: {} } as any;
    const plugin = new ZeRspackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
    });
    plugin.apply(mockCompiler as any);
  });
});

describe('withZephyr Performance', () => {
  // We need to make this a synchronous benchmark since async benchmarks
  // can be more difficult to interpret
  bench('Configuration transformation', async () => {
    const config = {
      context: '/mock/context',
      plugins: [],
    };

    // Call the function but don't wait for the promise to resolve
    // This is just to measure the synchronous part of the function
    withZephyr()(config);
  });
});
