import { bench, describe } from 'vitest';
import { ZeRepackPlugin } from './ze-repack-plugin';
import * as xpackInternal from 'zephyr-xpack-internal';

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

jest.mock('find-package-json', () => {
  return () => ({
    next: jest.fn().mockReturnValue({
      value: { name: '@test/app' },
    }),
  });
});

jest.mock('./utils/get-platform', () => ({
  get_platform_from_repack: jest.fn().mockReturnValue('ios'),
}));

describe('ZeRepackPlugin Performance', () => {
  const mockCompiler = {
    hooks: {
      beforeCompile: { tap: jest.fn() },
      thisCompilation: { tap: jest.fn() },
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
    xpackInternal.logBuildSteps.mockReset();
    xpackInternal.setupZeDeploy.mockReset();

    const zephyrEngine = { buildProperties: {} } as any;
    const plugin = new ZeRepackPlugin({
      zephyr_engine: zephyrEngine,
      mfConfig: undefined,
      target: 'ios',
    });

    plugin.apply(mockCompiler as any);

    // Verify that the hooks were called
    expect(xpackInternal.logBuildSteps).toHaveBeenCalled();
    expect(xpackInternal.setupZeDeploy).toHaveBeenCalled();
  });
});
