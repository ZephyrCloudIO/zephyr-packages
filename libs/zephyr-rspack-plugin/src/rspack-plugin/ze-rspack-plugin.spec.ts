import { ZeRspackPlugin, ZephyrRspackInternalPluginOptions } from './ze-rspack-plugin';
import { withZephyr, Configuration } from './with-zephyr';
import { ZephyrEngine } from 'zephyr-agent';
import * as xpackInternal from 'zephyr-xpack-internal';
import { ZeBundlerType, ZeInternalPluginOptions } from 'zephyr-xpack-internal';
import { RspackCompiler } from '../types';

// Define helper functions to access protected properties for testing
// These must be defined outside the class to avoid TypeScript errors
const getOptions = (plugin: ZeRspackPlugin): ZephyrRspackInternalPluginOptions => {
  // This unsafe cast is only for testing
  return (plugin as any).options;
};

const getBundlerType = (plugin: ZeRspackPlugin): ZeBundlerType => {
  // This unsafe cast is only for testing
  return (plugin as any).bundlerType;
};

// Mock dependencies
jest.mock('zephyr-agent', () => ({
  ZephyrEngine: {
    create: jest.fn().mockResolvedValue({
      resolve_remote_dependencies: jest.fn().mockResolvedValue([]),
      buildProperties: {},
    }),
  },
  ze_log: jest.fn(),
}));

jest.mock('zephyr-xpack-internal', () => {
  class MockBasePlugin {
    protected options: ZeInternalPluginOptions;
    protected bundlerType: string;

    constructor(options: ZeInternalPluginOptions, bundlerType: string) {
      this.options = options;
      this.bundlerType = bundlerType;
    }

    // Empty implementations required by abstract class
    protected log(): void {
      /* Empty implementation for testing */
    }
    protected logError(): void {
      /* Empty implementation for testing */
    }
    protected logWarning(): void {
      /* Empty implementation for testing */
    }

    // Helper methods for testing
    _getOptions(): ZeInternalPluginOptions {
      return this.options;
    }

    _getBundlerType(): string {
      return this.bundlerType;
    }
  }

  return {
    ZeBasePlugin: MockBasePlugin,
    extractFederatedDependencyPairs: jest.fn().mockReturnValue([]),
    makeCopyOfModuleFederationOptions: jest.fn().mockReturnValue({}),
    mutWebpackFederatedRemotesConfig: jest.fn(),
    logBuildSteps: jest.fn(),
    setupZeDeploy: jest.fn(),
  };
});

// Helper methods are now defined directly in the class

interface MockCompiler {
  hooks: {
    beforeCompile: { tap: jest.Mock };
    thisCompilation: { tap: jest.Mock };
  };
  outputPath: string;
}

interface MockZephyrEngine {
  buildProperties: {
    output?: string;
  };
}

describe('ZeRspackPlugin', () => {
  let mockCompiler: MockCompiler;

  beforeEach(() => {
    mockCompiler = {
      hooks: {
        beforeCompile: { tap: jest.fn() },
        thisCompilation: { tap: jest.fn() },
      },
      outputPath: '/mock/output/path',
    };

    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should set options with default pluginName', () => {
      const zephyrEngine: MockZephyrEngine = { buildProperties: {} };
      const plugin = new ZeRspackPlugin({
        zephyr_engine: zephyrEngine as unknown as ZephyrEngine,
        mfConfig: undefined,
      });

      expect(getOptions(plugin).pluginName).toBe('ZeRspackPlugin');
      expect(getOptions(plugin).zephyr_engine).toBe(zephyrEngine);
    });

    it('should set bundlerType to rspack', () => {
      const zephyrEngine: MockZephyrEngine = { buildProperties: {} };
      const plugin = new ZeRspackPlugin({
        zephyr_engine: zephyrEngine as unknown as ZephyrEngine,
        mfConfig: undefined,
      });

      expect(getBundlerType(plugin)).toBe('rspack');
    });
  });

  describe('apply', () => {
    it('should set output path on zephyr_engine', () => {
      const zephyrEngine: MockZephyrEngine = { buildProperties: {} };
      const plugin = new ZeRspackPlugin({
        zephyr_engine: zephyrEngine as unknown as ZephyrEngine,
        mfConfig: undefined,
      });

      plugin.apply(mockCompiler as unknown as RspackCompiler);

      expect(zephyrEngine.buildProperties.output).toBe('/mock/output/path');
    });

    it('should call logBuildSteps and setupZeDeploy', () => {
      const zephyrEngine: MockZephyrEngine = { buildProperties: {} };
      const plugin = new ZeRspackPlugin({
        zephyr_engine: zephyrEngine as unknown as ZephyrEngine,
        mfConfig: undefined,
      });

      plugin.apply(mockCompiler as unknown as RspackCompiler);

      expect(xpackInternal.logBuildSteps).toHaveBeenCalledWith(
        getOptions(plugin),
        mockCompiler
      );
      expect(xpackInternal.setupZeDeploy).toHaveBeenCalledWith(
        getOptions(plugin),
        mockCompiler
      );
    });
  });

  describe('processAssets', () => {
    it('should return success when called', async () => {
      const zephyrEngine: MockZephyrEngine = { buildProperties: {} };
      const plugin = new ZeRspackPlugin({
        zephyr_engine: zephyrEngine as unknown as ZephyrEngine,
        mfConfig: undefined,
      });

      // Access the protected method using type assertion
      const result = await (
        plugin as unknown as { processAssets(): Promise<unknown> }
      ).processAssets();

      expect(result).toEqual({ success: true });
    });

    it('should handle errors gracefully', async () => {
      const zephyrEngine: MockZephyrEngine = { buildProperties: {} };
      const plugin = new ZeRspackPlugin({
        zephyr_engine: zephyrEngine as unknown as ZephyrEngine,
        mfConfig: undefined,
      });

      // Mock an error by making processAssets throw
      jest
        .spyOn(
          plugin as unknown as { processAssets(): Promise<unknown> },
          'processAssets'
        )
        .mockImplementationOnce(() => {
          throw new Error('Test error');
        });

      try {
        await (
          plugin as unknown as { processAssets(): Promise<unknown> }
        ).processAssets();
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toBe('Test error');
      }
    });
  });
});

// Define test configuration type
interface MockConfiguration {
  context: string;
  plugins: unknown[];
}

describe('withZephyr', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create ZephyrEngine with correct parameters', async () => {
    const config: MockConfiguration = {
      context: '/mock/context',
      plugins: [],
    };

    await withZephyr()(config as unknown as Configuration);

    expect(ZephyrEngine.create).toHaveBeenCalledWith({
      builder: 'rspack',
      context: '/mock/context',
    });
  });

  it('should extract and resolve dependencies', async () => {
    const mockEngine = {
      resolve_remote_dependencies: jest.fn().mockResolvedValue([]),
      buildProperties: {},
    };
    (ZephyrEngine.create as jest.Mock).mockResolvedValue(mockEngine);
    const config: MockConfiguration = {
      context: '/mock/context',
      plugins: [],
    };

    await withZephyr()(config as unknown as Configuration);

    expect(xpackInternal.extractFederatedDependencyPairs).toHaveBeenCalledWith(config);
    expect(mockEngine.resolve_remote_dependencies).toHaveBeenCalled();
    expect(xpackInternal.mutWebpackFederatedRemotesConfig).toHaveBeenCalled();
  });

  it('should add ZeRspackPlugin to config.plugins', async () => {
    const config: MockConfiguration = {
      context: '/mock/context',
      plugins: [],
    };

    const result = await withZephyr()(config as unknown as Configuration);

    expect(result.plugins?.length).toBe(1);
    expect(result.plugins?.[0]).toBeInstanceOf(ZeRspackPlugin);
  });

  it('should pass options to ZeRspackPlugin', async () => {
    const config: MockConfiguration = {
      context: '/mock/context',
      plugins: [],
    };

    const result = await withZephyr({ wait_for_index_html: true })(
      config as unknown as Configuration
    );

    const plugin = result.plugins?.[0] as ZeRspackPlugin;
    expect(getOptions(plugin).wait_for_index_html).toBe(true);
  });
});
