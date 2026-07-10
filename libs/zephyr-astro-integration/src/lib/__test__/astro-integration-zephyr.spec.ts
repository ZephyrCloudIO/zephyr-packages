import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';
import type { Plugin, ResolvedConfig } from 'vite';

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { logFn, zeBuildDashData, ZephyrEngine, ZephyrError } from 'zephyr-agent';
import { withZephyr } from '../astro-integration-zephyr';
import { extractAstroAssetsFromBuildHook } from '../internal/extract-astro-assets-map';

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
    ZephyrError: {
      format: agentMocks.formatError,
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
        root: new URL('file:///test/project/'),
      };

      await integration.hooks['astro:config:done']?.({
        config: mockConfig,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:config:done']>>[0]);

      expect(mockZephyrDeferCreate).toHaveBeenCalledWith({
        builder: 'astro',
        context: '/test/project/',
      });
    });
  });

  describe('astro:build:done hook', () => {
    it('should complete the full build workflow with assets parameter', async () => {
      const integration = withZephyr();
      const mockDir = new URL('file:///test/dist/');
      const mockAssets = { 'index.html': '/test/dist/index.html' };
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

      expect(mockZephyrEngine.buildProperties.output).toBe('/test/dist/');
      expect(mockZephyrEngine.start_new_build).toHaveBeenCalled();
      expect(extractAstroAssetsFromBuildHook).toHaveBeenCalledWith(
        mockAssets,
        '/test/dist/'
      );
      expect(mockZephyrEngine.upload_assets).toHaveBeenCalledWith({
        assetsMap: mockAssetsMap,
        buildStats: mockBuildStats,
      });
      expect(mockZephyrEngine.build_finished).toHaveBeenCalled();
    });

    it('should handle missing assets parameter gracefully', async () => {
      const integration = withZephyr();
      const mockDir = new URL('file:///test/dist/');
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
        '/test/dist/'
      );
      expect(mockZephyrEngine.upload_assets).toHaveBeenCalled();
    });

    it('should handle errors during build completion', async () => {
      const integration = withZephyr();
      const mockDir = new URL('file:///test/dist/');
      const mockAssets = { 'index.html': '/test/dist/index.html' };
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
      const mockDir = new URL('file:///test/dist/');

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
      const mockConfig = { root: new URL('file:///test/project/') };
      await integration.hooks['astro:config:done']?.({
        config: mockConfig,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:config:done']>>[0]);

      // Then call build:done
      const mockDir = new URL('file:///test/dist/');
      await integration.hooks['astro:build:done']?.({
        dir: mockDir,
      } as Parameters<NonNullable<(typeof integration.hooks)['astro:build:done']>>[0]);

      expect(mockZephyrEngine.start_new_build).toHaveBeenCalled();
      expect(mockZephyrEngine.build_finished).toHaveBeenCalled();
    });
  });
});
