import { bench, describe, vi, expect } from 'vitest';
import { ZeRepackPlugin } from './ze-repack-plugin';

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

const mockFindPackageJson = () => ({
  next: vi.fn().mockReturnValue({
    value: { name: '@test/app' },
  }),
});

const mockGetPlatform = {
  get_platform_from_repack: vi.fn().mockReturnValue('ios'),
};

vi.mock('zephyr-agent', () => mockZephyrAgent);
vi.mock('zephyr-xpack-internal', () => mockXpackInternal);
vi.mock('find-package-json', () => mockFindPackageJson);
vi.mock('./utils/get-platform', () => mockGetPlatform);

describe('ZeRepackPlugin Performance', () => {
  const mockCompiler = {
    hooks: {
      beforeCompile: { tap: vi.fn() },
      thisCompilation: { tap: vi.fn() },
    },
    outputPath: '/mock/output/path',
  };

  bench('Constructor initialization', () => {
    const zephyrEngine = { buildProperties: {} } as any;
    new ZeRepackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
      target: 'ios',
    });
  });

  bench('Plugin apply method', () => {
    const zephyrEngine = { buildProperties: {} } as any;
    const plugin = new ZeRepackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
      target: 'ios',
    });
    plugin.apply(mockCompiler as any);
  });

  bench('Plugin hooks performance', () => {
    // Test the performance of the plugin hooks internally
    mockXpackInternal.logBuildSteps.mockClear();
    mockXpackInternal.setupZeDeploy.mockClear();

    const zephyrEngine = { buildProperties: {} } as any;
    const plugin = new ZeRepackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
      target: 'ios',
    });

    plugin.apply(mockCompiler as any);

    // Verify that the hooks were called
    expect(mockXpackInternal.logBuildSteps).toHaveBeenCalled();
    expect(mockXpackInternal.setupZeDeploy).toHaveBeenCalled();
  });
});
