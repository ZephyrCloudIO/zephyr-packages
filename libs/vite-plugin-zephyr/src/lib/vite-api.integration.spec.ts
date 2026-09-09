import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test, rs } from '@rstest/core';
import { build, createBuilder, type InlineConfig, type Plugin } from 'vite';
import type { ZeBuildAssetsMap } from 'zephyr-agent';

const mocks = rs.hoisted(() => {
  const events: string[] = [];
  const partials = new Map<string, Record<string, ZeBuildAssetsMap>>();
  const engine = {
    application_uid: 'fixture.vite.test',
    buildProperties: { output: 'dist', baseHref: '' },
    federated_dependencies: [],
    hasActiveBuild: false,
    start_new_build: rs.fn(async () => {
      engine.hasActiveBuild = true;
    }),
    upload_assets: rs.fn(async (_options: { assetsMap: ZeBuildAssetsMap }) => {
      events.push('upload');
    }),
    build_finished: rs.fn(async () => {
      events.push('finish');
      engine.hasActiveBuild = false;
    }),
    build_failed: rs.fn(() => {
      engine.hasActiveBuild = false;
    }),
  };
  return { events, partials, engine };
});

rs.mock('zephyr-agent', () => {
  // Import pure helpers directly; the public barrel initializes credential storage.
  const { ApplicationContext } = rs.requireActual(
    '../../../zephyr-agent/src/zephyr-engine/application-context'
  );
  const { zeBuildAssets } = rs.requireActual(
    '../../../zephyr-agent/src/lib/transformers/ze-build-assets'
  );
  const { readDirRecursiveWithContents } = rs.requireActual(
    '../../../zephyr-agent/src/lib/utils/read-dir-recursive'
  );
  return {
    ApplicationContext,
    zeBuildAssets,
    readDirRecursiveWithContents,
    buildAssetsMap(
      assets: Record<string, unknown>,
      extract: (asset: unknown) => string | Buffer
    ) {
      return Object.fromEntries(
        Object.entries(assets).map(([filepath, asset]) => {
          const value = zeBuildAssets({ filepath, content: extract(asset) });
          return [value.hash, value];
        })
      );
    },
    ZephyrEngine: {
      defer_create: () => ({
        zephyr_engine_defer: Promise.resolve(mocks.engine),
        zephyr_defer_create: rs.fn(),
      }),
    },
    savePartialAssetMap: async (
      _uid: string,
      key: string,
      assets: ZeBuildAssetsMap,
      scope: object
    ) => {
      const id = JSON.stringify(scope);
      const maps = mocks.partials.get(id) ?? {};
      maps[key] = assets;
      mocks.partials.set(id, maps);
    },
    claimPartialAssetMapBatch: async (_uid: string, scopes: object[]) => {
      if (scopes.some((scope) => !mocks.partials.has(JSON.stringify(scope))))
        return undefined;
      return {
        claims: scopes.map((scope) => ({
          scope,
          claimId: JSON.stringify(scope),
          partialAssetMaps: mocks.partials.get(JSON.stringify(scope)),
        })),
      };
    },
    commitPartialAssetMapClaimBatch: async (_uid: string, ids: string[]) => {
      for (const id of ids) mocks.partials.delete(id);
    },
    rollbackPartialAssetMapClaimBatch: rs.fn(),
    createManifestContent: () =>
      JSON.stringify({ version: '1.0.0', dependencies: {}, zeVars: {} }),
    normalizeBasePath: (base: string) => base.replace(/^\/+|\/+$/g, ''),
    rewriteEnvReadsToVirtualModule: () => null,
    zeBuildDashData: async () => ({}),
    assertZephyrBuildTarget: rs.fn(),
    readPackageJson: () => ({}),
    ze_log: { init: rs.fn(), remotes: rs.fn() },
    handleGlobalError: (error: unknown) => {
      throw error;
    },
    ZeErrors: { ERR_DEPLOY_LOCAL_BUILD: {}, ERR_UNKNOWN: {} },
    ZephyrError: class extends Error {
      constructor(_code: unknown, options: { message: string }) {
        super(options.message);
      }
    },
  };
});

import { withZephyr } from './vite-plugin-zephyr';

const fixtureRoot = path.join(import.meta.dirname, '__fixtures__/vite-api');
const originalInvocation = process.env['ZE_BUILD_INVOCATION_ID'];
let outputRoot: string;

beforeEach(async () => {
  rs.clearAllMocks();
  mocks.events.length = 0;
  mocks.partials.clear();
  mocks.engine.hasActiveBuild = false;
  delete process.env['ZE_BUILD_INVOCATION_ID'];
  rs.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    throw new Error('The Vite integration test must not make network requests');
  });
  outputRoot = await mkdtemp(path.join(tmpdir(), 'zephyr-vite-api-'));
});

afterEach(async () => {
  rs.restoreAllMocks();
  if (originalInvocation === undefined) delete process.env['ZE_BUILD_INVOCATION_ID'];
  else process.env['ZE_BUILD_INVOCATION_ID'] = originalInvocation;
  await rm(outputRoot, { recursive: true, force: true });
});

function config(plugins: Plugin[] = []): InlineConfig {
  return {
    root: fixtureRoot,
    configFile: false,
    envFile: false,
    publicDir: false,
    logLevel: 'silent',
    plugins: [...plugins, ...withZephyr()],
    build: { outDir: outputRoot, minify: false },
  };
}

function publishedPaths(): string[] {
  expect(mocks.engine.upload_assets).toHaveBeenCalledTimes(1);
  expect(mocks.engine.build_finished).toHaveBeenCalledTimes(1);
  const [publication] = mocks.engine.upload_assets.mock.calls[0];
  return Object.values(publication.assetsMap).map((asset) => asset.path);
}

test('real vite.build publishes the single environment exactly once', async () => {
  await build(config());

  const paths = publishedPaths();
  expect(paths).toContain('index.html');
  expect(paths).toContain('zephyr-manifest.json');
  expect(paths.some((name) => name.endsWith('.js'))).toBe(true);
  expect(mocks.events).toEqual(['upload', 'finish']);
  expect(mocks.partials.size).toBe(0);
});

test('legacy vite.build stays direct when builder options are present', async () => {
  await build({ ...config(), builder: {} });

  expect(publishedPaths()).toContain('index.html');
  expect(mocks.events).toEqual(['upload', 'finish']);
  expect(mocks.partials.size).toBe(0);
});

test('plain createBuilder publishes once without explicit builder configuration', async () => {
  const builder = await createBuilder(config());
  await builder.buildApp();

  expect(publishedPaths()).toContain('index.html');
  expect(mocks.events).toEqual(['upload', 'finish']);
  expect(mocks.partials.size).toBe(0);
});

test('an earlier pre buildApp plugin is rejected before anything can publish', async () => {
  const earlierHook = rs.fn();
  await expect(
    createBuilder(
      config([
        {
          name: 'fixture-earlier-build',
          enforce: 'pre',
          buildApp: { order: 'pre', handler: earlierHook },
        },
      ])
    )
  ).rejects.toThrow('Place withZephyr() before other pre-ordered buildApp plugins');

  expect(earlierHook).not.toHaveBeenCalled();
  expect(mocks.engine.upload_assets).not.toHaveBeenCalled();
  expect(mocks.engine.build_finished).not.toHaveBeenCalled();
  expect(mocks.events).toEqual([]);
});

function applicationConfig(failServer = false): InlineConfig {
  const framework: Plugin = {
    name: 'fixture-framework',
    async buildApp(builder) {
      await builder.build(builder.environments.client);
      expect(mocks.engine.upload_assets).not.toHaveBeenCalled();
      await builder.build(builder.environments.server);
      expect(mocks.engine.upload_assets).not.toHaveBeenCalled();
      await Promise.resolve();
      mocks.events.push('framework-postprocessed');
    },
    buildStart() {
      if (failServer && this.environment.name === 'server') {
        throw new Error('fixture server compilation failed');
      }
    },
  };
  return {
    ...config([framework]),
    environments: {
      client: { consumer: 'client', build: { outDir: path.join(outputRoot, 'client') } },
      server: {
        consumer: 'server',
        build: {
          outDir: path.join(outputRoot, 'server'),
          ssr: path.join(fixtureRoot, 'server.js'),
          rolldownOptions: { output: { entryFileNames: 'index.js' } },
        },
      },
    },
  };
}

test('real buildApp publishes all environments after framework post-processing', async () => {
  const builder = await createBuilder(applicationConfig());
  await builder.buildApp();

  const paths = publishedPaths();
  expect(paths).toContain('client/index.html');
  expect(paths.some((name) => name.startsWith('client/') && name.endsWith('.js'))).toBe(
    true
  );
  expect(paths).toContain('server/index.js');
  expect(mocks.events).toEqual(['framework-postprocessed', 'upload', 'finish']);
  expect(mocks.partials.size).toBe(0);
});

test('real buildApp does not publish when the second environment fails', async () => {
  const builder = await createBuilder(applicationConfig(true));
  await expect(builder.buildApp()).rejects.toThrow('fixture server compilation failed');

  expect(mocks.engine.upload_assets).not.toHaveBeenCalled();
  expect(mocks.engine.build_finished).not.toHaveBeenCalled();
  expect(mocks.events).toEqual([]);
});
