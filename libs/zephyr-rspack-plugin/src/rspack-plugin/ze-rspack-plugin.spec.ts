import { ZeRspackPlugin } from './ze-rspack-plugin';
import { withZephyr } from './with-zephyr';
import { ZephyrEngine } from 'zephyr-agent';
import * as xpackInternal from 'zephyr-xpack-internal';

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

jest.mock('zephyr-xpack-internal', () => ({
  extractFederatedDependencyPairs: jest.fn().mockReturnValue([]),
  makeCopyOfModuleFederationOptions: jest.fn().mockReturnValue({}),
  mutWebpackFederatedRemotesConfig: jest.fn(),
  logBuildSteps: jest.fn(),
  setupZeDeploy: jest.fn(),
}));

describe('ZeRspackPlugin', () => {
  let mockCompiler: any;

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
      const zephyrEngine = { buildProperties: {} } as any;
      const plugin = new ZeRspackPlugin({
        zephyr_engine: zephyrEngine,
        mfConfig: undefined,
      });

      expect(plugin._options.pluginName).toBe('ZeRspackPlugin');
      expect(plugin._options.zephyr_engine).toBe(zephyrEngine);
    });
  });

  describe('apply', () => {
    it('should set output path on zephyr_engine', () => {
      const zephyrEngine = { buildProperties: {} } as any;
      const plugin = new ZeRspackPlugin({
        zephyr_engine: zephyrEngine,
        mfConfig: undefined,
      });

      plugin.apply(mockCompiler);

      expect(zephyrEngine.buildProperties.output).toBe('/mock/output/path');
    });

    it('should call logBuildSteps and setupZeDeploy', () => {
      const zephyrEngine = { buildProperties: {} } as any;
      const plugin = new ZeRspackPlugin({
        zephyr_engine: zephyrEngine,
        mfConfig: undefined,
      });

      plugin.apply(mockCompiler);

      expect(xpackInternal.logBuildSteps).toHaveBeenCalledWith(
        plugin._options,
        mockCompiler
      );
      expect(xpackInternal.setupZeDeploy).toHaveBeenCalledWith(
        plugin._options,
        mockCompiler
      );
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
    const config = {
      context: '/mock/context',
      plugins: [],
    };

    await withZephyr()(config);

    expect(xpackInternal.extractFederatedDependencyPairs).toHaveBeenCalledWith(config);
    expect(mockEngine.resolve_remote_dependencies).toHaveBeenCalled();
    expect(xpackInternal.mutWebpackFederatedRemotesConfig).toHaveBeenCalled();
  });

  it('should add ZeRspackPlugin to config.plugins', async () => {
    const config = {
      context: '/mock/context',
      plugins: [],
    };

    const result = await withZephyr()(config);

    expect(result.plugins?.length).toBe(1);
    expect(result.plugins?.[0]).toBeInstanceOf(ZeRspackPlugin);
  });

  it('should pass options to ZeRspackPlugin', async () => {
    const config = {
      context: '/mock/context',
      plugins: [],
    };

    const result = await withZephyr({ wait_for_index_html: true })(config);

    const plugin = result.plugins?.[0] as ZeRspackPlugin;
    expect(plugin._options.wait_for_index_html).toBe(true);
  });
});
