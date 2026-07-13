import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';
import type { Plugin, ResolvedConfig } from 'vite';

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { logFn, zeBuildDashData, ZephyrEngine, ZephyrError } from 'zephyr-agent';
import { withZephyr } from '../astro-integration-zephyr';
import { extractAstroAssetsFromBuildHook } from '../internal/extract-astro-assets-map';

const TEST_PROJECT_DIRECTORY = `${join(tmpdir(), 'zephyr-astro-tests', 'project')}${sep}`;
const TEST_DIST_DIRECTORY = `${join(tmpdir(), 'zephyr-astro-tests', 'dist')}${sep}`;
const TEST_PROJECT_URL = pathToFileURL(TEST_PROJECT_DIRECTORY);
const TEST_DIST_URL = pathToFileURL(TEST_DIST_DIRECTORY);

const agentMocks = rs.hoisted(() => ({
  logFn: rs.fn(),
  formatError: rs.fn(),
}));

// Mock dependencies
rs.mock('zephyr-agent', () => {
  const actual = rs.requireActual('zephyr-agent') as Record<string, unknown>;
  return {
    ...actual,
    ZephyrEngine: {
      defer_create: rs.fn(),
    },
    logFn: agentMocks.logFn,
    ZeErrors: { ERR_DEPLOY_LOCAL_BUILD: 'ERR_DEPLOY_LOCAL_BUILD' },
    ZephyrError: class extends Error {
      static format = agentMocks.formatError;

      constructor(_: unknown, props?: { message?: string }) {
        super(props?.message);
      }
    },
    zeBuildDashData: rs.fn(),
    handleGlobalError: rs.fn().mockImplementation((error) => {
      agentMocks.logFn('error', agentMocks.formatError(error));
    }),
  };
});

rs.mock('../internal/extract-astro-assets-map', () => ({
  extractAstroAssetsFromBuildHook: rs.fn(),
}));

interface MockZephyrEngine {
  application_uid: string;
  buildProperties: { output: string };
  build_id?: Promise<string>;
  start_new_build: Mock;
  upload_assets: Mock;
  build_finished: Mock;
  build_failed: Mock;
}

async function getInjectedVitePlugin(): Promise<Plugin> {
  const integration = withZephyr();
  const updateConfig = rs.fn();

  await integration.hooks['astro:config:setup']?.({
    updateConfig,
  } as Parameters<NonNullable<(typeof integration.hooks)['astro:config:setup']>>[0]);

  const config = updateConfig.mock.calls[0]?.[0] as {
    vite?: { plugins?: Plugin[] };
  };
  const plugin = config.vite?.plugins?.[0];
  if (!plugin) throw new Error('Astro integration did not inject its Vite plugin');
  return plugin;
}

async function withProcessEnv<T>(
  overrides: Record<string, string | undefined>,
  action: () => Promise<T>
): Promise<T> {
  const previous = new Map(
    Object.keys(overrides).map((name) => [name, process.env[name]])
  );
  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    return await action();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

describe('withZephyr', () => {
  let mockZephyrEngine: MockZephyrEngine;
  let mockZephyrDefer: Promise<MockZephyrEngine>;
  let mockZephyrDeferCreate: Mock;

  beforeEach(() => {
    rs.clearAllMocks();

    // Mock ZephyrEngine setup
    mockZephyrEngine = {
      application_uid: 'org.project.astro',
      buildProperties: { output: '' },
      build_id: Promise.resolve('build-id'),
      start_new_build: rs.fn(),
      upload_assets: rs.fn(),
      build_finished: rs.fn(),
      build_failed: rs.fn(),
    };

    mockZephyrDefer = Promise.resolve(mockZephyrEngine);

    mockZephyrDeferCreate = rs.fn();

    const mockDeferCreate = rs.fn().mockReturnValue({
      zephyr_engine_defer: mockZephyrDefer,
      zephyr_defer_create: mockZephyrDeferCreate,
    });

    (ZephyrEngine.defer_create as Mock).mockImplementation(mockDeferCreate);

    (extractAstroAssetsFromBuildHook as Mock).mockResolvedValue({});
    (ZephyrError.format as Mock).mockImplementation((error: Error) => error.message);
  });

  describe('Basic Integration Structure', () => {
    it('rejects an unsupported untyped target before creating an engine', () => {
      expect(() => withZephyr({ target: 'desktop' as never })).toThrow(
        'withZephyr({ target }) must be one of'
      );
      expect(ZephyrEngine.defer_create).not.toHaveBeenCalled();
    });

    it('should return an Astro integration object', () => {
      const integration = withZephyr();

      expect(integration).toHaveProperty('name', 'with-zephyr');
      expect(integration).toHaveProperty('hooks');
      expect(integration.hooks).toHaveProperty('astro:config:done');
      expect(integration.hooks).toHaveProperty('astro:build:done');
      expect(integration.hooks).toHaveProperty('astro:config:setup');
    });

    it('should accept options parameter', () => {
      const integration = withZephyr();

      expect(integration).toHaveProperty('name', 'with-zephyr');
    });

    it('should have the correct hook functions', () => {
      const integration = withZephyr();

      expect(typeof integration.hooks['astro:config:done']).toBe('function');
      expect(typeof integration.hooks['astro:build:done']).toBe('function');
      expect(typeof integration.hooks['astro:config:setup']).toBe('function');
    });
  });

  describe('astro:config:setup hook', () => {
    it('should inject Vite plugin for ZE_PUBLIC_* rewrite behavior', async () => {
      const plugin = await getInjectedVitePlugin();

      expect(plugin.name).toBe('with-zephyr-astro-env');
      expect(plugin.enforce).toBe('pre');
    });

    it('does not inject the source or chunk rewriting Vite plugin for tap-app', async () => {
      const integration = withZephyr({ target: 'tap-app' });
      const updateConfig = rs.fn();

      await integration.hooks['astro:config:setup']?.({
        updateConfig,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:config:setup']>>[0]);

      expect(updateConfig).not.toHaveBeenCalled();
    });

    it('loads ZE_PUBLIC_* values from the active Vite env without replacing process values', async () => {
      const root = await mkdtemp(join(tmpdir(), 'zephyr-astro-env-'));
      try {
        await writeFile(
          join(root, '.env.preview'),
          [
            'ZE_PUBLIC_ASTRO_FROM_FILE=from-file',
            'ZE_PUBLIC_ASTRO_EXISTING=from-file',
            'PRIVATE_ASTRO_ENV_TEST=secret',
          ].join('\n')
        );

        await withProcessEnv(
          {
            ZE_PUBLIC_ASTRO_FROM_FILE: undefined,
            ZE_PUBLIC_ASTRO_EXISTING: 'from-process',
            PRIVATE_ASTRO_ENV_TEST: undefined,
          },
          async () => {
            const plugin = await getInjectedVitePlugin();
            const configResolved = plugin.configResolved as (
              config: ResolvedConfig
            ) => Promise<void>;

            await configResolved({ mode: 'preview', root } as ResolvedConfig);

            expect(process.env['ZE_PUBLIC_ASTRO_FROM_FILE']).toBe('from-file');
            expect(process.env['ZE_PUBLIC_ASTRO_EXISTING']).toBe('from-process');
            expect(process.env['PRIVATE_ASTRO_ENV_TEST']).toBeUndefined();
          }
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it('rewrites ZE_PUBLIC_* reads to the application-scoped virtual module', async () => {
      const plugin = await getInjectedVitePlugin();
      const transform = (
        plugin.transform as {
          handler: (
            code: string,
            id: string
          ) => Promise<{ code: string; map: null } | null>;
        }
      ).handler;
      const source = [
        'const publicValue = import.meta.env.ZE_PUBLIC_API_URL;',
        'const privateValue = process.env.PRIVATE_API_TOKEN;',
      ].join('\n');

      const result = await transform(source, '/project/src/page.ts');

      expect(result?.code).toContain(
        "import __ZE_MANIFEST__ from 'env:vars:org.project.astro' with { type: 'json' };"
      );
      expect(result?.code).toContain(
        'const publicValue = __ZE_MANIFEST__.zeVars.ZE_PUBLIC_API_URL;'
      );
      expect(result?.code).toContain(
        'const privateValue = process.env.PRIVATE_API_TOKEN;'
      );
      expect(
        await transform(source, '/project/node_modules/package/index.js')
      ).toBeNull();
    });

    it('externalizes the application env module for builds and maps it in development', async () => {
      const plugin = await getInjectedVitePlugin();
      const resolveId = plugin.resolveId as (
        source: string
      ) => Promise<string | { id: string; external: boolean } | null>;
      const specifier = 'env:vars:org.project.astro';

      await withProcessEnv({ NODE_ENV: 'production' }, async () => {
        await expect(resolveId(specifier)).resolves.toEqual({
          id: specifier,
          external: true,
        });
      });
      await withProcessEnv({ NODE_ENV: 'development' }, async () => {
        await expect(resolveId(specifier)).resolves.toBe('/zephyr-manifest.json');
      });
      await expect(resolveId('unrelated-module')).resolves.toBeNull();
    });

    it('restores the JSON import attribute if Vite omits it from a chunk', async () => {
      const plugin = await getInjectedVitePlugin();
      await (plugin.resolveId as (source: string) => Promise<unknown>)(
        'env:vars:org.project.astro'
      );
      const renderChunk = (
        plugin.renderChunk as {
          handler: (code: string) => { code: string; map: null } | null;
        }
      ).handler;

      const result = renderChunk(
        "import zephyrEnv from 'env:vars:org.project.astro';\nconsole.log(zephyrEnv);"
      );

      expect(result?.code).toContain(
        "from 'env:vars:org.project.astro' with { type: 'json' }"
      );
      expect(
        renderChunk(
          "import zephyrEnv from 'env:vars:org.project.astro' with { type: 'json' };"
        )
      ).toBeNull();
    });
  });

  describe('astro:config:done hook', () => {
    it('should initialize ZephyrEngine with correct context from config.root', async () => {
      const integration = withZephyr();

      const mockConfig = {
        root: TEST_PROJECT_URL,
      };

      await integration.hooks['astro:config:done']?.({
        config: mockConfig,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:config:done']>>[0]);

      expect(mockZephyrDeferCreate).toHaveBeenCalledWith({
        builder: 'astro',
        context: TEST_PROJECT_DIRECTORY,
      });
    });

    it('forwards tap-app to ZephyrEngine creation', async () => {
      const integration = withZephyr({ target: 'tap-app' });

      await integration.hooks['astro:config:done']?.({
        config: { root: TEST_PROJECT_URL },
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:config:done']>>[0]);

      expect(mockZephyrDeferCreate).toHaveBeenCalledWith({
        builder: 'astro',
        context: TEST_PROJECT_DIRECTORY,
        target: 'tap-app',
      });
    });
  });

  describe('astro:build:done hook', () => {
    it('should complete the full build workflow with assets parameter', async () => {
      const integration = withZephyr();
      const mockDir = TEST_DIST_URL;
      const mockAssets = { 'index.html': join(TEST_DIST_DIRECTORY, 'index.html') };
      const mockAssetsMap = { hash1: { content: 'test', type: 'text/html' } };
      const mockBuildStats = { stats: 'test' };

      (extractAstroAssetsFromBuildHook as Mock).mockResolvedValue(mockAssetsMap);
      (zeBuildDashData as Mock).mockResolvedValue(mockBuildStats);

      await integration.hooks['astro:build:done']?.({
        dir: mockDir,
        assets: mockAssets,
      } as unknown as Parameters<
        NonNullable<(typeof integration.hooks)['astro:build:done']>
      >[0]);

      expect(mockZephyrEngine.buildProperties.output).toBe(TEST_DIST_DIRECTORY);
      expect(mockZephyrEngine.start_new_build).toHaveBeenCalled();
      expect(extractAstroAssetsFromBuildHook).toHaveBeenCalledWith(
        mockAssets,
        TEST_DIST_DIRECTORY,
        undefined
      );
      expect(mockZephyrEngine.upload_assets).toHaveBeenCalledWith({
        assetsMap: mockAssetsMap,
        buildStats: mockBuildStats,
      });
      expect(mockZephyrEngine.build_finished).toHaveBeenCalled();
    });

    it('forwards every aligned TAP Federation container without a legacy fallback', async () => {
      const mfConfigs = [
        { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
        { name: 'quickjs', filename: 'targets/quickjs/remoteEntry.mjs' },
      ];
      const federation = [
        { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' },
        { name: 'quickjs', remote: 'targets/quickjs/remoteEntry.mjs' },
      ];
      const mockAssetsMap = { hash1: { content: 'test', type: 'text/html' } };
      const mockBuildStats = { stats: 'test' };
      const integration = withZephyr({
        target: 'tap-app',
        mfConfigs,
        federation,
      });
      (extractAstroAssetsFromBuildHook as Mock).mockResolvedValue(mockAssetsMap);
      (zeBuildDashData as Mock).mockResolvedValue(mockBuildStats);

      await integration.hooks['astro:build:done']?.({
        dir: TEST_DIST_URL,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:build:done']>>[0]);

      const upload = mockZephyrEngine.upload_assets.mock.calls[0]?.[0] as {
        mfConfig?: unknown;
        mfConfigs?: unknown;
        buildStats: { federation?: unknown };
      };
      expect(upload.mfConfigs).toBe(mfConfigs);
      expect(upload).not.toHaveProperty('mfConfig');
      expect(upload.buildStats.federation).toBe(federation);
    });

    it('derives legacy mfConfig only for one complete Federation config', async () => {
      const config = {
        name: 'desktop',
        filename: 'targets/desktop/remoteEntry.mjs',
      };
      const integration = withZephyr({ mfConfigs: [config] });
      (extractAstroAssetsFromBuildHook as Mock).mockResolvedValue({ hash1: {} });
      (zeBuildDashData as Mock).mockResolvedValue({});

      await integration.hooks['astro:build:done']?.({
        dir: TEST_DIST_URL,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:build:done']>>[0]);

      const upload = mockZephyrEngine.upload_assets.mock.calls[0]?.[0] as {
        mfConfig?: unknown;
        mfConfigs?: unknown;
      };
      expect(upload.mfConfigs).toEqual([config]);
      expect(upload.mfConfig).toBe(config);
    });

    it('fails closed for TAP metadata that is missing or mismatched', async () => {
      const integration = withZephyr({
        target: 'tap-app',
        mfConfigs: [{ name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' }],
        federation: [{ name: 'desktop', remote: 'targets/quickjs/remoteEntry.mjs' }],
      });
      (extractAstroAssetsFromBuildHook as Mock).mockResolvedValue({ hash1: {} });

      await integration.hooks['astro:build:done']?.({
        dir: TEST_DIST_URL,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:build:done']>>[0]);

      expect(mockZephyrEngine.upload_assets).not.toHaveBeenCalled();
      expect(mockZephyrEngine.build_failed).toHaveBeenCalledTimes(1);
      expect(ZephyrError.format).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('no matching') })
      );
    });

    it('fails closed for duplicate TAP Module Federation config identities', async () => {
      const integration = withZephyr({
        target: 'tap-app',
        mfConfigs: [
          { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
          { name: 'desktop', filename: 'targets/tablet/remoteEntry.mjs' },
        ],
        federation: [
          { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' },
          { name: 'tablet', remote: 'targets/tablet/remoteEntry.mjs' },
        ],
      });
      (extractAstroAssetsFromBuildHook as Mock).mockResolvedValue({ hash1: {} });

      await integration.hooks['astro:build:done']?.({
        dir: TEST_DIST_URL,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:build:done']>>[0]);

      expect(mockZephyrEngine.upload_assets).not.toHaveBeenCalled();
      expect(ZephyrError.format).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('duplicate names') })
      );
    });

    it('should handle missing assets parameter gracefully', async () => {
      const integration = withZephyr();
      const mockDir = TEST_DIST_URL;
      const mockAssetsMap = { hash1: { content: 'test', type: 'text/html' } };
      const mockBuildStats = { stats: 'test' };

      (extractAstroAssetsFromBuildHook as Mock).mockResolvedValue(mockAssetsMap);
      (zeBuildDashData as Mock).mockResolvedValue(mockBuildStats);

      // Call without assets parameter
      await integration.hooks['astro:build:done']?.({
        dir: mockDir,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:build:done']>>[0]);

      expect(extractAstroAssetsFromBuildHook).toHaveBeenCalledWith(
        undefined,
        TEST_DIST_DIRECTORY,
        undefined
      );
      expect(mockZephyrEngine.upload_assets).toHaveBeenCalled();
    });

    it('threads tap-app to strict asset extraction and does not publish on read failure', async () => {
      const integration = withZephyr({ target: 'tap-app' });
      const mockAssets = {
        'manifest.tap.json': join(TEST_DIST_DIRECTORY, 'manifest.tap.json'),
      };
      const readError = new Error('locked artifact could not be read');
      (extractAstroAssetsFromBuildHook as Mock).mockRejectedValue(readError);

      await integration.hooks['astro:build:done']?.({
        dir: TEST_DIST_URL,
        assets: mockAssets,
      } as unknown as Parameters<
        NonNullable<(typeof integration.hooks)['astro:build:done']>
      >[0]);

      expect(extractAstroAssetsFromBuildHook).toHaveBeenCalledWith(
        mockAssets,
        TEST_DIST_DIRECTORY,
        'tap-app'
      );
      expect(mockZephyrEngine.upload_assets).not.toHaveBeenCalled();
      expect(mockZephyrEngine.build_failed).toHaveBeenCalledTimes(1);
    });

    it('should handle errors during build completion', async () => {
      const integration = withZephyr();
      const mockDir = TEST_DIST_URL;
      const mockAssets = { 'index.html': join(TEST_DIST_DIRECTORY, 'index.html') };
      const testError = new Error('Build failed');

      (extractAstroAssetsFromBuildHook as Mock).mockRejectedValue(testError);

      await integration.hooks['astro:build:done']?.({
        dir: mockDir,
        assets: mockAssets,
      } as unknown as Parameters<
        NonNullable<(typeof integration.hooks)['astro:build:done']>
      >[0]);

      expect(ZephyrError.format).toHaveBeenCalledWith(testError);
      expect(logFn).toHaveBeenCalledWith('error', 'Build failed');
      expect(mockZephyrEngine.build_failed).toHaveBeenCalledTimes(1);
    });

    it('should handle engine initialization errors', async () => {
      const badEngine = Promise.reject(new Error('Engine failed'));
      (ZephyrEngine.defer_create as Mock).mockReturnValue({
        zephyr_engine_defer: badEngine,
        zephyr_defer_create: rs.fn(),
      });

      const integration = withZephyr();
      const mockDir = TEST_DIST_URL;

      await integration.hooks['astro:build:done']?.({
        dir: mockDir,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:build:done']>>[0]);

      expect(ZephyrError.format).toHaveBeenCalledWith(new Error('Engine failed'));
      expect(logFn).toHaveBeenCalledWith('error', 'Engine failed');
    });
  });

  describe('Integration Lifecycle', () => {
    it('should handle sequential hook calls correctly', async () => {
      const integration = withZephyr();

      // First call config:done
      const mockConfig = { root: TEST_PROJECT_URL };
      await integration.hooks['astro:config:done']?.({
        config: mockConfig,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:config:done']>>[0]);

      // Then call build:done
      const mockDir = TEST_DIST_URL;
      await integration.hooks['astro:build:done']?.({
        dir: mockDir,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:build:done']>>[0]);

      expect(mockZephyrEngine.start_new_build).toHaveBeenCalled();
      expect(mockZephyrEngine.build_finished).toHaveBeenCalled();
    });
  });
});
