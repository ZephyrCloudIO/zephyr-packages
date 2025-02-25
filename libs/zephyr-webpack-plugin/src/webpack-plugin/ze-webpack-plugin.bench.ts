import { bench, describe, vi } from 'vitest';
import { ZeWebpackPlugin } from './ze-webpack-plugin';
import { withZephyr } from './with-zephyr';

// Mock the ZephyrEngine for benchmarking
const mockZephyrEngine = {
  create: vi.fn().mockResolvedValue({
    resolve_remote_dependencies: vi.fn().mockResolvedValue([]),
    buildProperties: {},
  }),
};

// Mock the xpackInternal module
const mockXpackInternal = {
  extractFederatedDependencyPairs: vi.fn().mockReturnValue([]),
  makeCopyOfModuleFederationOptions: vi.fn().mockReturnValue({}),
  mutWebpackFederatedRemotesConfig: vi.fn(),
  logBuildSteps: vi.fn(),
  setupZeDeploy: vi.fn(),
};

// Use Vitest's vi.mock for module mocking
vi.mock('zephyr-agent', () => ({
  ZephyrEngine: mockZephyrEngine,
  ze_log: vi.fn(),
}));

vi.mock('zephyr-xpack-internal', () => mockXpackInternal);

describe('ZeWebpackPlugin Performance', () => {
  const mockCompiler = {
    hooks: {
      beforeCompile: { tap: vi.fn() },
      thisCompilation: { tap: vi.fn() },
    },
    outputPath: '/mock/output/path',
  };

  bench('Constructor initialization', () => {
    const zephyrEngine = { buildProperties: {} } as any;
    new ZeWebpackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
    });
  });

  bench('Plugin apply method', () => {
    const zephyrEngine = { buildProperties: {} } as any;
    const plugin = new ZeWebpackPlugin({
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
