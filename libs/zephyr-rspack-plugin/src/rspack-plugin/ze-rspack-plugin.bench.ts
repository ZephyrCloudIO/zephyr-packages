import { bench, describe, vi } from 'vitest';
import { ZeRspackPlugin } from './ze-rspack-plugin';
import { withZephyr } from './with-zephyr';

// Mock dependencies to avoid actual network calls
const mockZephyrAgent = {
  ZephyrEngine: {
    create: vi.fn().mockResolvedValue({
      resolve_remote_dependencies: vi.fn().mockResolvedValue([]),
      buildProperties: {},
    }),
  },
  ze_log: vi.fn(),
};

const mockXpackInternal = {
  extractFederatedDependencyPairs: vi.fn().mockReturnValue([]),
  makeCopyOfModuleFederationOptions: vi.fn().mockReturnValue({}),
  mutWebpackFederatedRemotesConfig: vi.fn(),
  logBuildSteps: vi.fn(),
  setupZeDeploy: vi.fn(),
};

vi.mock('zephyr-agent', () => mockZephyrAgent);
vi.mock('zephyr-xpack-internal', () => mockXpackInternal);

describe('ZeRspackPlugin Performance', () => {
  const mockCompiler = {
    hooks: {
      beforeCompile: { tap: vi.fn() },
      thisCompilation: { tap: vi.fn() },
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
