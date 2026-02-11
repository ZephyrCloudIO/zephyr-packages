import { extname } from 'node:path';
import { withZephyr } from './with-zephyr';

const mockEngine = {
  env: { ssr: false },
  upload_assets: jest.fn(),
};

const mockCreateEngine = jest.fn(async () => mockEngine);
const mockReadDirRecursiveWithContents = jest.fn();
const mockZeBuildDashData = jest.fn(async () => ({ buildStats: true }));
const mockHandleGlobalError = jest.fn();

const mockRspackWithZephyr = jest.fn((options) => async (config) => {
  (config as Record<string, unknown>).__zephyrOptions = options;
  return config;
});

jest.mock('zephyr-agent', () => ({
  ZephyrEngine: {
    create: (...args: unknown[]) => mockCreateEngine(...args),
  },
  handleGlobalError: (...args: unknown[]) => mockHandleGlobalError(...args),
  readDirRecursiveWithContents: (...args: unknown[]) =>
    mockReadDirRecursiveWithContents(...args),
  zeBuildAssets: ({
    filepath,
    content,
  }: {
    filepath: string;
    content: string | Buffer;
  }) => {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    return {
      path: filepath,
      extname: extname(filepath),
      hash: `${filepath}:${buffer.length}`,
      size: buffer.length,
      buffer,
    };
  },
  zeBuildDashData: (...args: unknown[]) => mockZeBuildDashData(...args),
  ze_log: {
    upload: jest.fn(),
  },
}));

jest.mock('zephyr-rspack-plugin', () => ({
  withZephyr: (...args: unknown[]) => mockRspackWithZephyr(...args),
}));

type BeforeCreateCompilerArgs = {
  bundlerConfigs: Array<{ context?: string }>;
  environments: Record<string, { name: string; distPath: string }>;
};

type AfterBuildArgs = {
  environments: Record<string, { name: string; distPath: string }>;
};

interface MockApiResult {
  api: {
    context: { rootPath: string };
    onBeforeCreateCompiler: (hook: {
      handler: (args: BeforeCreateCompilerArgs) => Promise<void>;
    }) => void;
    onAfterBuild: (hook: { handler: (args: AfterBuildArgs) => Promise<void> }) => void;
  };
  readonly beforeCreateCompiler: (args: BeforeCreateCompilerArgs) => Promise<void>;
  readonly afterBuild: (args: AfterBuildArgs) => Promise<void>;
}

function createMockApi(): MockApiResult {
  let beforeCreateCompiler:
    | ((args: BeforeCreateCompilerArgs) => Promise<void>)
    | undefined;
  let afterBuild: ((args: AfterBuildArgs) => Promise<void>) | undefined;

  return {
    api: {
      context: {
        rootPath: '/repo/app',
      },
      onBeforeCreateCompiler(hook: {
        handler: (args: BeforeCreateCompilerArgs) => Promise<void>;
      }) {
        beforeCreateCompiler = hook.handler;
      },
      onAfterBuild(hook: { handler: (args: AfterBuildArgs) => Promise<void> }) {
        afterBuild = hook.handler;
      },
    },
    get beforeCreateCompiler() {
      if (!beforeCreateCompiler) {
        throw new Error('beforeCreateCompiler hook was not registered');
      }
      return beforeCreateCompiler;
    },
    get afterBuild() {
      if (!afterBuild) {
        throw new Error('afterBuild hook was not registered');
      }
      return afterBuild;
    },
  };
}

describe('zephyr-rsbuild-plugin combined uploads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEngine.env.ssr = false;
    mockEngine.upload_assets.mockResolvedValue(undefined);
  });

  it('auto-detects SSR and uploads once with combined assets', async () => {
    const mockApi = createMockApi();
    const plugin = withZephyr();
    await Promise.resolve(plugin.setup(mockApi.api as never));

    mockReadDirRecursiveWithContents.mockImplementation(async (dirPath: string) => {
      if (dirPath === '/repo/app/dist/client') {
        return [
          {
            fullPath: '/repo/app/dist/client/index.html',
            relativePath: 'index.html',
            isDirectory: false,
            content: Buffer.from('<html />'),
          },
          {
            fullPath: '/repo/app/dist/client/static/main.js',
            relativePath: 'static/main.js',
            isDirectory: false,
            content: Buffer.from('console.log("client")'),
          },
        ];
      }

      if (dirPath === '/repo/app/dist/server') {
        return [
          {
            fullPath: '/repo/app/dist/server/server.js',
            relativePath: 'server.js',
            isDirectory: false,
            content: Buffer.from('console.log("server")'),
          },
        ];
      }

      return [];
    });

    await mockApi.beforeCreateCompiler({
      bundlerConfigs: [{ context: '/repo/app' }, { context: '/repo/app' }],
      environments: {
        web: { name: 'web', distPath: '/repo/app/dist/client' },
        ssr: { name: 'ssr', distPath: '/repo/app/dist/server' },
      },
    });

    expect(mockCreateEngine).toHaveBeenCalledTimes(1);
    expect(mockRspackWithZephyr).toHaveBeenCalledTimes(2);
    expect(mockRspackWithZephyr.mock.calls[0][0]).toMatchObject({
      disable_upload: true,
      zephyr_engine: mockEngine,
    });

    await mockApi.afterBuild({
      environments: {
        web: { name: 'web', distPath: '/repo/app/dist/client' },
        ssr: { name: 'ssr', distPath: '/repo/app/dist/server' },
      },
    });

    expect(mockZeBuildDashData).toHaveBeenCalledWith(mockEngine);
    expect(mockEngine.upload_assets).toHaveBeenCalledTimes(1);
    expect(mockEngine.upload_assets).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotType: 'ssr',
        entrypoint: 'server/server.js',
        buildStats: { buildStats: true },
      })
    );
    expect(mockHandleGlobalError).not.toHaveBeenCalled();
  });

  it('keeps legacy per-environment behavior when upload_strategy is per-environment', async () => {
    const mockApi = createMockApi();
    const plugin = withZephyr({ upload_strategy: 'per-environment' });
    await Promise.resolve(plugin.setup(mockApi.api as never));

    await mockApi.beforeCreateCompiler({
      bundlerConfigs: [{ context: '/repo/app' }],
      environments: {
        web: { name: 'web', distPath: '/repo/app/dist' },
        ssr: { name: 'ssr', distPath: '/repo/app/ssr' },
      },
    });

    expect(mockCreateEngine).not.toHaveBeenCalled();
    expect(mockRspackWithZephyr.mock.calls[0][0]).toMatchObject({
      disable_upload: false,
      zephyr_engine: undefined,
    });

    await mockApi.afterBuild({
      environments: {
        web: { name: 'web', distPath: '/repo/app/dist' },
        ssr: { name: 'ssr', distPath: '/repo/app/ssr' },
      },
    });

    expect(mockEngine.upload_assets).not.toHaveBeenCalled();
  });

  it('normalizes explicit SSR entrypoint for combined uploads', async () => {
    const mockApi = createMockApi();
    const plugin = withZephyr({
      upload_strategy: 'combined',
      snapshot_type: 'ssr',
      entrypoint: './dist/server/index.js',
    });
    await Promise.resolve(plugin.setup(mockApi.api as never));

    mockReadDirRecursiveWithContents.mockResolvedValue([
      {
        fullPath: '/repo/app/dist/server/index.js',
        relativePath: 'index.js',
        isDirectory: false,
        content: Buffer.from('console.log("server")'),
      },
    ]);

    await mockApi.beforeCreateCompiler({
      bundlerConfigs: [{ context: '/repo/app' }],
      environments: {
        ssr: { name: 'ssr', distPath: '/repo/app/dist/server' },
      },
    });

    await mockApi.afterBuild({
      environments: {
        ssr: { name: 'ssr', distPath: '/repo/app/dist/server' },
      },
    });

    expect(mockEngine.upload_assets).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotType: 'ssr',
        entrypoint: 'server/index.js',
      })
    );
  });
});
