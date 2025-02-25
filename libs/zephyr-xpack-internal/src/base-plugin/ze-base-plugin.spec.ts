import { ZeBasePlugin, ZeProcessAssetsResult } from './ze-base-plugin';
import { ZeInternalPluginOptions, ZePluginOptions } from '../xpack.types';

// Mock implementation of the abstract base class for testing
class TestPlugin extends ZeBasePlugin {
  public testLog(message: string): void {
    return this.log(message);
  }

  public testLogError(message: string): void {
    return this.logError(message);
  }

  public testLogWarning(message: string): void {
    return this.logWarning(message);
  }

  public async testInitialize(): Promise<void> {
    return this.initialize();
  }

  protected async processAssets(): Promise<ZeProcessAssetsResult> {
    return { success: true };
  }

  // Expose static method for testing
  public static testCreateOptions<T extends ZePluginOptions>(
    userOptions: Partial<T> = {},
    defaults: Partial<T> = {}
  ): T {
    return ZeBasePlugin.createOptions(userOptions, defaults);
  }
}

describe('ZeBasePlugin', () => {
  // Mock console methods
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  let mockConsoleLog: jest.Mock;
  let mockConsoleError: jest.Mock;
  let mockConsoleWarn: jest.Mock;

  beforeEach(() => {
    mockConsoleLog = jest.fn();
    mockConsoleError = jest.fn();
    mockConsoleWarn = jest.fn();

    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    console.warn = mockConsoleWarn;
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  it('should create a plugin with the correct bundler type', () => {
    const options: ZeInternalPluginOptions = {
      zephyr_engine: {},
      pluginName: 'test-plugin',
    };

    const plugin = new TestPlugin(options, 'webpack');

    expect(plugin['bundlerType']).toBe('webpack');
    expect(plugin['pluginName']).toBe('test-plugin');
  });

  it('should use default plugin name if not provided', () => {
    const options: ZeInternalPluginOptions = {
      zephyr_engine: {},
      pluginName: '',
    };

    const plugin = new TestPlugin(options, 'rollup');

    expect(plugin['pluginName']).toBe('zephyr-rollup-plugin');
  });

  it('should log messages with the plugin name prefix', () => {
    const options: ZeInternalPluginOptions = {
      zephyr_engine: {},
      pluginName: 'test-plugin',
    };

    const plugin = new TestPlugin(options, 'webpack');
    plugin.testLog('Test message');

    expect(mockConsoleLog).toHaveBeenCalledWith('[test-plugin] Test message');
  });

  it('should log error messages with the plugin name prefix', () => {
    const options: ZeInternalPluginOptions = {
      zephyr_engine: {},
      pluginName: 'test-plugin',
    };

    const plugin = new TestPlugin(options, 'webpack');
    plugin.testLogError('Test error');

    expect(mockConsoleError).toHaveBeenCalledWith('[test-plugin] ERROR: Test error');
  });

  it('should log warning messages with the plugin name prefix', () => {
    const options: ZeInternalPluginOptions = {
      zephyr_engine: {},
      pluginName: 'test-plugin',
    };

    const plugin = new TestPlugin(options, 'webpack');
    plugin.testLogWarning('Test warning');

    expect(mockConsoleWarn).toHaveBeenCalledWith('[test-plugin] WARNING: Test warning');
  });

  it('should merge default options with user options', () => {
    type TestOptions = ZePluginOptions & {
      option1?: string;
      option2?: string;
      option3?: string;
    };

    const defaults: Partial<TestOptions> = { option1: 'default1', option2: 'default2' };
    const userOptions: Partial<TestOptions> = { option2: 'user2', option3: 'user3' };

    const result = TestPlugin.testCreateOptions<TestOptions>(userOptions, defaults);

    expect(result).toEqual({
      option1: 'default1',
      option2: 'user2',
      option3: 'user3',
    });
  });
});
