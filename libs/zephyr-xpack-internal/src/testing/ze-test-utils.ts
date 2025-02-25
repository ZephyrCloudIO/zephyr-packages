/** Testing utilities for Zephyr plugins Provides common mocks and fixtures for testing */

import { ZeBuildAsset, ZeBuildAssetsMap } from '../xpack.types';

/** Mock ZephyrEngine for testing */
export class MockZephyrEngine {
  public readonly builder: string;
  public upload_called = false;
  public upload_assets_called = false;

  constructor(builder = 'webpack') {
    this.builder = builder;
  }

  /** Mock implementation of upload method */
  async upload(): Promise<void> {
    this.upload_called = true;
    return Promise.resolve();
  }

  /** Mock implementation of upload_assets method */
  async upload_assets(
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    _assets: ZeBuildAssetsMap
  ): Promise<void> {
    this.upload_assets_called = true;
    return Promise.resolve();
  }

  /** Mock implementation of defer_create method */
  static defer_create(): MockZephyrEngine {
    return new MockZephyrEngine();
  }
}

/** Creates a mock build asset */
export function createMockAsset(name: string, content = 'test content'): ZeBuildAsset {
  return {
    name,
    source: content,
    size: content.length,
  };
}

/** Creates a mock assets map */
export function createMockAssetsMap(assetNames: string[]): ZeBuildAssetsMap {
  return assetNames.reduce((map, name) => {
    map[name] = createMockAsset(name);
    return map;
  }, {} as ZeBuildAssetsMap);
}

/** Mock compiler for testing */
// Define a more specific type for the compiler
export interface MockCompiler {
  options: {
    output: {
      path: string;
      publicPath: string;
      [key: string]: unknown;
    };
    plugins: unknown[];
  };
  hooks: {
    compilation: {
      tap: unknown;
    };
    afterEmit: {
      tapAsync: unknown;
    };
    done: {
      tap: unknown;
    };
  };
  webpack: {
    RuntimeGlobals: {
      loadScript: string;
    };
  };
  [key: string]: unknown;
}

export function createMockCompiler(options = {}): MockCompiler {
  return {
    options: {
      output: {
        path: '/mock/output/path',
        publicPath: '/public/',
        ...options,
      },
      plugins: [],
    },
    hooks: {
      compilation: {
        tap: function (name: string, callback: unknown): void {
          // Store the callback for later execution
          const compilerStorage = createMockCompiler as {
            lastCompilationCallback?: unknown;
          };
          compilerStorage.lastCompilationCallback = callback;
        },
      },
      afterEmit: {
        tapAsync: function (name: string, callback: unknown): void {
          // Store the callback for later execution
          const compilerStorage = createMockCompiler as {
            lastAfterEmitCallback?: unknown;
          };
          compilerStorage.lastAfterEmitCallback = callback;
        },
      },
      done: {
        tap: function (name: string, callback: unknown): void {
          // Store the callback for later execution
          const compilerStorage = createMockCompiler as { lastDoneCallback?: unknown };
          compilerStorage.lastDoneCallback = callback;
        },
      },
    },
    webpack: {
      RuntimeGlobals: {
        loadScript: 'webpack_loadScript',
      },
    },
  };
}

/** Execute stored compiler callbacks for testing */
export function executeCompilerCallbacks(compiler: MockCompiler, compilation = {}): void {
  // Execute compilation callback
  // We need to use an namespace object for storing callbacks
  // Access the shared storage through a namespace property
  const compilerStorage = createMockCompiler as {
    lastCompilationCallback?: (compilation: unknown) => void;
    lastAfterEmitCallback?: (compilation: unknown, callback: () => void) => void;
    lastDoneCallback?: (stats: unknown) => void;
  };

  if (compilerStorage.lastCompilationCallback) {
    compilerStorage.lastCompilationCallback(compilation);
  }

  // Execute afterEmit callback
  if (compilerStorage.lastAfterEmitCallback) {
    compilerStorage.lastAfterEmitCallback(compilation, () => {
      // Empty callback for testing
      return undefined;
    });
  }

  // Execute done callback
  if (compilerStorage.lastDoneCallback) {
    compilerStorage.lastDoneCallback({
      compilation,
      toJson: () => ({
        entrypoints: {},
        chunks: [],
        modules: [],
      }),
    });
  }
}
