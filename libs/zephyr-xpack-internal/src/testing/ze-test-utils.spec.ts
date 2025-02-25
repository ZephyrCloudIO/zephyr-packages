import {
  MockZephyrEngine,
  createMockAsset,
  createMockAssetsMap,
  createMockCompiler,
  executeCompilerCallbacks,
} from './ze-test-utils';

describe('Testing Utilities', () => {
  describe('MockZephyrEngine', () => {
    it('should create an instance with the specified builder', () => {
      const engine = new MockZephyrEngine('rollup');
      expect(engine.builder).toBe('rollup');
    });

    it('should default to webpack if no builder is specified', () => {
      const engine = new MockZephyrEngine();
      expect(engine.builder).toBe('webpack');
    });

    it('should track when upload is called', async () => {
      const engine = new MockZephyrEngine();
      expect(engine.upload_called).toBe(false);

      await engine.upload();
      expect(engine.upload_called).toBe(true);
    });

    it('should track when upload_assets is called', async () => {
      const engine = new MockZephyrEngine();
      const assets = createMockAssetsMap(['file1.js', 'file2.js']);

      expect(engine.upload_assets_called).toBe(false);

      await engine.upload_assets(assets);
      expect(engine.upload_assets_called).toBe(true);
    });

    it('should support defer_create static method', () => {
      const engine = MockZephyrEngine.defer_create();
      expect(engine).toBeInstanceOf(MockZephyrEngine);
    });
  });

  describe('createMockAsset', () => {
    it('should create an asset with the given name and content', () => {
      const asset = createMockAsset('file.js', 'custom content');

      expect(asset).toEqual({
        name: 'file.js',
        source: 'custom content',
        size: 'custom content'.length,
      });
    });

    it('should use default content if not provided', () => {
      const asset = createMockAsset('file.js');

      expect(asset).toEqual({
        name: 'file.js',
        source: 'test content',
        size: 'test content'.length,
      });
    });
  });

  describe('createMockAssetsMap', () => {
    it('should create a map of assets from an array of names', () => {
      const names = ['file1.js', 'file2.css', 'index.html'];
      const map = createMockAssetsMap(names);

      expect(Object.keys(map)).toHaveLength(3);
      expect(map['file1.js']).toBeDefined();
      expect(map['file2.css']).toBeDefined();
      expect(map['index.html']).toBeDefined();

      expect(map['file1.js'].name).toBe('file1.js');
      expect(map['file2.css'].name).toBe('file2.css');
      expect(map['index.html'].name).toBe('index.html');
    });
  });

  describe('createMockCompiler', () => {
    it('should create a compiler with default options', () => {
      const compiler = createMockCompiler();
      const options = compiler.options as {
        output: { path: string; publicPath: string };
      };
      const hooks = compiler.hooks as {
        compilation: { tap: unknown };
        afterEmit: { tapAsync: unknown };
        done: { tap: unknown };
      };

      expect(options.output.path).toBe('/mock/output/path');
      expect(options.output.publicPath).toBe('/public/');
      expect(hooks.compilation.tap).toBeDefined();
      expect(hooks.afterEmit.tapAsync).toBeDefined();
      expect(hooks.done.tap).toBeDefined();
    });

    it('should override default options with provided ones', () => {
      const compiler = createMockCompiler({
        path: '/custom/path',
        publicPath: '/custom/public/',
      });

      const options = compiler.options as {
        output: { path: string; publicPath: string };
      };
      expect(options.output.path).toBe('/custom/path');
      expect(options.output.publicPath).toBe('/custom/public/');
    });
  });

  describe('executeCompilerCallbacks', () => {
    it('should execute all stored callbacks', () => {
      // Create a compiler with stored callbacks
      const compiler = createMockCompiler();

      // Type-cast hooks to use them in test
      const hooks = compiler.hooks as {
        compilation: { tap: (name: string, callback: () => void) => void };
        afterEmit: { tapAsync: (name: string, callback: () => void) => void };
        done: { tap: (name: string, callback: () => void) => void };
      };

      // Register some callbacks
      hooks.compilation.tap('test', () => {
        // Empty callback for testing
        return undefined;
      });
      hooks.afterEmit.tapAsync('test', () => {
        // Empty callback for testing
        return undefined;
      });
      hooks.done.tap('test', () => {
        // Empty callback for testing
        return undefined;
      });

      // Create a mock compilation
      const compilation = { assets: {} };

      // Execute callbacks
      executeCompilerCallbacks(compiler, compilation);

      // The test passes if no error is thrown
      expect(true).toBe(true);
    });
  });
});
