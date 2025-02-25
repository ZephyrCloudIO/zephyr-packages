import { ZeWebpackPlugin } from '../webpack-plugin/ze-webpack-plugin';
import { withZephyr } from '../webpack-plugin/with-zephyr';
import { WebpackCompiler } from '../types';
import { ZephyrEngine } from 'zephyr-agent';
import * as xpackInternal from 'zephyr-xpack-internal';

// Mock dependencies
jest.mock('zephyr-agent');
jest.mock('zephyr-xpack-internal', () => ({
  extractFederatedDependencyPairs: jest.fn().mockReturnValue([]),
  makeCopyOfModuleFederationOptions: jest.fn().mockReturnValue({}),
  mutWebpackFederatedRemotesConfig: jest.fn(),
  logBuildSteps: jest.fn(),
  setupZeDeploy: jest.fn(),
  buildWebpackAssetMap: jest.fn().mockReturnValue({}),
  ZeBasePlugin: class MockBasePlugin {
    options;
    bundlerType;

    constructor(options: unknown, bundlerType: string) {
      this.options = options;
      this.bundlerType = bundlerType;
    }

    // Make the protected field accessible for testing
    getOptions(): unknown {
      return this.options;
    }
  },
}));

// Create a proper mock for ZephyrEngine
class MockZephyrEngine {
  buildProperties: { output?: string } = {};

  static create = jest.fn().mockResolvedValue(new MockZephyrEngine());

  resolve_remote_dependencies = jest.fn().mockResolvedValue([]);
  upload_assets = jest.fn().mockResolvedValue(undefined);
  start_new_build = jest.fn().mockResolvedValue(undefined);
  logger = Promise.resolve(jest.fn());
}

// Update the mocked ZephyrEngine
(ZephyrEngine as unknown) = MockZephyrEngine;

describe('ZeWebpackPlugin', () => {
  // Create a mock compiler
  let mockCompiler: WebpackCompiler;

  beforeEach(() => {
    // Create a mock that satisfies the WebpackCompiler interface
    mockCompiler = {
      hooks: {
        beforeCompile: { tapAsync: jest.fn() },
        thisCompilation: { tap: jest.fn() },
        failed: { tap: jest.fn() },
      },
      outputPath: '/mock/output/path',
      compilation: {},
      webpack: {
        Compilation: {
          PROCESS_ASSETS_STAGE_REPORT: 5000,
        },
      },
    } as unknown as WebpackCompiler;

    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should set options with correct values', () => {
      const zephyrEngine = new MockZephyrEngine();
      const plugin = new ZeWebpackPlugin({
        zephyr_engine: zephyrEngine as unknown as ZephyrEngine,
        mfConfig: undefined,
      });

      // @ts-expect-error - Access via test helper
      const options = plugin.getOptions();
      expect(options.pluginName).toBe('ZeWebpackPlugin');
      expect(options.zephyr_engine).toBe(zephyrEngine);
    });
  });

  describe('apply', () => {
    it('should set output path on zephyr_engine', () => {
      const zephyrEngine = new MockZephyrEngine();
      const plugin = new ZeWebpackPlugin({
        zephyr_engine: zephyrEngine as unknown as ZephyrEngine,
        mfConfig: undefined,
      });

      plugin.apply(mockCompiler);

      expect(zephyrEngine.buildProperties.output).toBe('/mock/output/path');
    });

    it('should call logBuildSteps and setupZeDeploy', () => {
      const zephyrEngine = new MockZephyrEngine();
      const plugin = new ZeWebpackPlugin({
        zephyr_engine: zephyrEngine as unknown as ZephyrEngine,
        mfConfig: undefined,
      });

      plugin.apply(mockCompiler);

      // @ts-expect-error - Access via test helper
      const options = plugin.getOptions();
      expect(xpackInternal.logBuildSteps).toHaveBeenCalledWith(options, mockCompiler);
      expect(xpackInternal.setupZeDeploy).toHaveBeenCalledWith(options, mockCompiler);
    });
  });

  describe('processAssets', () => {
    it('should return success when called', async () => {
      const zephyrEngine = new MockZephyrEngine();

      const plugin = new ZeWebpackPlugin({
        zephyr_engine: zephyrEngine as unknown as ZephyrEngine,
        mfConfig: undefined,
      });

      // @ts-expect-error - Call protected method for testing
      const result = await plugin.processAssets();

      expect(result.success).toBe(true);
    });
  });
});

describe('withZephyr', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create ZephyrEngine with correct parameters', async () => {
    const config = {
      context: '/mock/context',
      plugins: [],
    };

    await withZephyr()(config);

    expect(ZephyrEngine.create).toHaveBeenCalledWith({
      builder: 'webpack',
      context: '/mock/context',
    });
  });

  it('should extract and resolve dependencies', async () => {
    const mockEngine = {
      resolve_remote_dependencies: jest.fn().mockResolvedValue([]),
      buildProperties: {},
    };
    (ZephyrEngine.create as jest.Mock).mockResolvedValue(mockEngine);
    const config = {
      context: '/mock/context',
      plugins: [],
    };

    await withZephyr()(config);

    expect(xpackInternal.extractFederatedDependencyPairs).toHaveBeenCalledWith(config);
    expect(mockEngine.resolve_remote_dependencies).toHaveBeenCalled();
    expect(xpackInternal.mutWebpackFederatedRemotesConfig).toHaveBeenCalled();
  });

  it('should add ZeWebpackPlugin to config.plugins', async () => {
    const config = {
      context: '/mock/context',
      plugins: [],
    };

    const result = await withZephyr()(config);

    expect(result.plugins?.length).toBe(1);
    expect(result.plugins?.[0]).toBeInstanceOf(ZeWebpackPlugin);
  });

  it('should pass options to ZeWebpackPlugin', async () => {
    const config = {
      context: '/mock/context',
      plugins: [],
    };

    const result = await withZephyr({ wait_for_index_html: true })(config);

    const plugin = result.plugins?.[0] as ZeWebpackPlugin;
    // @ts-expect-error - Access via test helper
    const options = plugin.getOptions();
    expect(options.wait_for_index_html).toBe(true);
  });
});
