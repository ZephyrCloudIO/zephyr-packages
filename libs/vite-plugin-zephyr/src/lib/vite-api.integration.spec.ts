import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test, rs } from '@rstest/core';
import { build, createBuilder, type InlineConfig, type Plugin } from 'vite';
import {
  claimPartialAssetMapBatch,
  commitPartialAssetMapClaimBatch,
  createManifestContent,
  zeBuildAssets,
  type ZeBuildAssetsMap,
} from 'zephyr-agent';

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
  return { events, partials, engine, manifestSequence: 0 };
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
    claimPartialAssetMapBatch: rs.fn(async (_uid: string, scopes: object[]) => {
      if (scopes.some((scope) => !mocks.partials.has(JSON.stringify(scope))))
        return undefined;
      return {
        claims: scopes.map((scope) => ({
          scope,
          claimId: JSON.stringify(scope),
          partialAssetMaps: mocks.partials.get(JSON.stringify(scope)),
        })),
      };
    }),
    commitPartialAssetMapClaimBatch: rs.fn(async (_uid: string, ids: string[]) => {
      for (const id of ids) mocks.partials.delete(id);
    }),
    rollbackPartialAssetMapClaimBatch: rs.fn(),
    createManifestContent: rs.fn(() =>
      JSON.stringify({
        version: '1.0.0',
        timestamp: new Date(mocks.manifestSequence++).toISOString(),
        dependencies: {},
        zeVars: {},
      })
    ),
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

import { withZephyr, type WithZephyrOptions } from './vite-plugin-zephyr';

const fixtureRoot = path.join(import.meta.dirname, '__fixtures__/vite-api');
const originalInvocation = process.env['ZE_BUILD_INVOCATION_ID'];
let outputRoot: string;

beforeEach(async () => {
  rs.clearAllMocks();
  mocks.events.length = 0;
  mocks.partials.clear();
  mocks.manifestSequence = 0;
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

function config(plugins: Plugin[] = [], options: WithZephyrOptions = {}): InlineConfig {
  return {
    root: fixtureRoot,
    configFile: false,
    envFile: false,
    publicDir: false,
    logLevel: 'silent',
    plugins: [...plugins, ...withZephyr(options)],
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

function ssrConfig(
  plugins: Plugin[] = [],
  options: WithZephyrOptions = {}
): InlineConfig {
  const base = config(plugins, options);
  return {
    ...base,
    build: {
      ...base.build,
      ssr: path.join(fixtureRoot, 'server.js'),
      rolldownOptions: { output: { entryFileNames: 'server-render.mjs' } },
    },
  };
}

test('direct SSR build infers its emitted server entry and snapshot type', async () => {
  await build(ssrConfig());

  expect(publishedPaths()).toContain('server-render.mjs');
  expect(mocks.engine.upload_assets.mock.calls[0][0]).toMatchObject({
    snapshotType: 'ssr',
    entrypoint: 'server-render.mjs',
  });
});

test('direct SSR build respects an explicit emitted entrypoint override', async () => {
  await build(
    ssrConfig(
      [
        {
          name: 'fixture-custom-server-entry',
          generateBundle() {
            this.emitFile({
              type: 'asset',
              fileName: 'custom-entry.mjs',
              source: 'export default () => "custom";',
            });
          },
        },
      ],
      { entrypoint: 'custom-entry.mjs' }
    )
  );

  expect(publishedPaths()).toContain('custom-entry.mjs');
  expect(mocks.engine.upload_assets.mock.calls[0][0]).toMatchObject({
    snapshotType: 'ssr',
    entrypoint: 'custom-entry.mjs',
  });
});

test('direct SSR build respects an explicit CSR snapshot override', async () => {
  await build(ssrConfig([], { snapshotType: 'csr' }));

  expect(publishedPaths()).toContain('server-render.mjs');
  expect(mocks.engine.upload_assets.mock.calls[0][0]).toMatchObject({
    snapshotType: 'csr',
  });
});

test('TAP server-shaped output defaults to CSR without inferring an SSR entry', async () => {
  await build(ssrConfig([], { target: 'tap-app' }));

  expect(publishedPaths()).toContain('server-render.mjs');
  expect(mocks.engine.upload_assets.mock.calls[0][0]).toMatchObject({
    snapshotType: 'csr',
  });
});

test('TAP server output can explicitly opt into SSR with its emitted entry', async () => {
  await build(
    ssrConfig([], {
      target: 'tap-app',
      snapshotType: 'ssr',
      entrypoint: 'server-render.mjs',
    })
  );

  expect(publishedPaths()).toContain('server-render.mjs');
  expect(mocks.engine.upload_assets.mock.calls[0][0]).toMatchObject({
    snapshotType: 'ssr',
    entrypoint: 'server-render.mjs',
  });
});

function libraryConfig(
  plugins: Plugin[] = [],
  options: WithZephyrOptions = {}
): InlineConfig {
  const base = config(plugins, options);
  return {
    ...base,
    build: {
      ...base.build,
      lib: {
        entry: path.join(fixtureRoot, 'server.js'),
        formats: ['es', 'cjs'],
        fileName: (format) => (format === 'es' ? 'library.mjs' : 'library.cjs'),
      },
    },
  };
}

test('multiple library outputs publish together exactly once', async () => {
  await build(libraryConfig());

  expect(publishedPaths()).toEqual(
    expect.arrayContaining(['library.mjs', 'library.cjs'])
  );
  expect(mocks.events).toEqual(['upload', 'finish']);
  expect(createManifestContent).toHaveBeenCalledTimes(1);
});

test('an output options object preserves both library formats in one publication', async () => {
  const base = libraryConfig();
  await build({
    ...base,
    build: { ...base.build, rolldownOptions: { output: { exports: 'named' } } },
  });
  expect(publishedPaths()).toEqual(
    expect.arrayContaining(['library.mjs', 'library.cjs'])
  );
  expect(createManifestContent).toHaveBeenCalledTimes(1);
});

test('an explicit ES and CJS output array publishes one combined snapshot', async () => {
  const base = config();
  await build({
    ...base,
    build: {
      ...base.build,
      lib: { entry: path.join(fixtureRoot, 'server.js') },
      rolldownOptions: {
        output: [
          { format: 'es', entryFileNames: 'explicit.mjs' },
          { format: 'cjs', entryFileNames: 'explicit.cjs' },
        ],
      },
    },
  });
  expect(publishedPaths()).toEqual(
    expect.arrayContaining(['explicit.mjs', 'explicit.cjs'])
  );
  expect(createManifestContent).toHaveBeenCalledTimes(1);
});

test('multiple library outputs consume external partial assets once', async () => {
  const scope = { invocationId: 'fixture-external-producer', generation: 0 };
  const asset = zeBuildAssets({ filepath: 'prerender/routes.json', content: '{}' });
  mocks.partials.set(JSON.stringify(scope), { prerender: { [asset.hash]: asset } });

  await build(libraryConfig([], { partialBuild: scope }));

  expect(publishedPaths()).toEqual(
    expect.arrayContaining(['library.mjs', 'library.cjs', 'prerender/routes.json'])
  );
  expect(claimPartialAssetMapBatch).toHaveBeenCalledTimes(1);
  expect(claimPartialAssetMapBatch).toHaveBeenCalledWith(mocks.engine.application_uid, [
    scope,
  ]);
  expect(commitPartialAssetMapClaimBatch).toHaveBeenCalledTimes(1);
  expect(mocks.partials.size).toBe(0);
});

test.each(['outputOptions', 'generateBundle'] as const)(
  'a later %s failure cannot publish the earlier output without renderError',
  async (hook) => {
    const renderError = rs.fn();
    const failure: Plugin = {
      name: 'fixture-failed-second-output',
      [hook](output: { format?: string }) {
        if (output.format === 'cjs') throw new Error('second library output failed');
      },
      renderError,
    };
    await expect(build(libraryConfig([failure]))).rejects.toThrow(
      'second library output failed'
    );
    expect(renderError).not.toHaveBeenCalled();
    expect(mocks.engine.upload_assets).not.toHaveBeenCalled();
    expect(mocks.engine.build_finished).not.toHaveBeenCalled();
  }
);

test.each(['writeBundle', 'closeBundle'] as const)(
  'a later post %s failure is rejected before direct publication',
  async (hook) => {
    const base = config();
    // Vite's final bundle close can replace the earlier publication-guard error.
    await expect(
      build({
        ...base,
        plugins: [
          ...(base.plugins ?? []),
          {
            name: 'fixture-late-output-writer',
            [hook]: {
              order: 'post',
              handler() {
                throw new Error(`late ${hook} failed`);
              },
            },
          },
        ],
      })
    ).rejects.toThrow(
      hook === 'closeBundle' ? /last.*hook|late closeBundle failed/ : /last.*hook/
    );
    expect(mocks.engine.upload_assets).not.toHaveBeenCalled();
    expect(mocks.engine.build_finished).not.toHaveBeenCalled();
  }
);

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
