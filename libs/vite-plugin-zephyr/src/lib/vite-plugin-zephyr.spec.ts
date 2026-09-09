import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, rs } from '@rstest/core';
import type * as NodeModule from 'node:module';
import type { Plugin, ResolvedConfig } from 'vite' with {
  'resolution-mode': 'import',
};
import { applyBaseHrefToAssets, type ZeBuildAssetsMap } from 'zephyr-agent';

const mocks = rs.hoisted(() => ({
  viteVersion: '7.0.0',
  federation: rs.fn(),
  extractAssets: rs.fn(),
  savePartialAssetMap: rs.fn(),
  claimPartialAssetMapBatch: rs.fn(),
  commitPartialAssetMapClaimBatch: rs.fn(),
  rollbackPartialAssetMapClaimBatch: rs.fn(),
  zeBuildDashData: rs.fn(async () => ({})),
  deferCreate: rs.fn(),
  zeLogInit: rs.fn(),
  engine: {
    application_uid: 'org.project.vite',
    buildProperties: { output: 'dist' },
    federated_dependencies: [],
    resolve_remote_dependencies: rs.fn(async () => []),
    upload_assets: rs.fn(async () => undefined),
    build_finished: rs.fn(async () => undefined),
    build_failed: rs.fn(),
    start_new_build: rs.fn(async () => undefined),
    hasActiveBuild: true,
    application_configuration: Promise.resolve<Record<string, unknown>>({}),
  },
}));

rs.mock('vite', () => ({
  loadEnv: rs.fn(() => ({})),
  get version() {
    return mocks.viteVersion;
  },
}));

rs.mock('node:module', () => {
  const actual = rs.requireActual('node:module') as typeof NodeModule;
  const actualRequire = actual.createRequire(__filename);
  return {
    ...actual,
    createRequire: () => (specifier: string) =>
      specifier === '@module-federation/vite'
        ? { federation: mocks.federation }
        : actualRequire(specifier),
  };
});

rs.mock('zephyr-agent', () => {
  const actual = rs.requireActual('zephyr-agent') as Record<string, unknown>;
  return {
    ...actual,
    claimPartialAssetMapBatch: mocks.claimPartialAssetMapBatch,
    commitPartialAssetMapClaimBatch: mocks.commitPartialAssetMapClaimBatch,
    rollbackPartialAssetMapClaimBatch: mocks.rollbackPartialAssetMapClaimBatch,
    savePartialAssetMap: mocks.savePartialAssetMap,
    zeBuildDashData: mocks.zeBuildDashData,
    ze_log: {
      ...(actual.ze_log as Record<string, unknown>),
      init: mocks.zeLogInit,
    },
    ZephyrEngine: {
      defer_create: () => ({
        zephyr_engine_defer: Promise.resolve(mocks.engine),
        zephyr_defer_create: mocks.deferCreate,
      }),
    },
  };
});

rs.mock('./internal/extract/extract_vite_assets_map', () => ({
  extract_vite_assets_map: mocks.extractAssets,
}));

import { withZephyr } from './vite-plugin-zephyr';
import { withZephyrPartial } from './vite-plugin-zephyr-partial';

const originalFailBuild = process.env['ZE_FAIL_BUILD'];
const originalBuildInvocationId = process.env['ZE_BUILD_INVOCATION_ID'];

function asset(path: string, hash = path): ZeBuildAssetsMap {
  return {
    [hash]: {
      path,
      hash,
      extname: path.includes('.') ? `.${path.split('.').pop()}` : '',
      size: 1,
      buffer: 'x',
    },
  };
}

function environmentOutput(environmentName: string, identity = 'output'): string {
  return `vite-environment:${encodeURIComponent(environmentName)}:${identity}`;
}

function resolvedConfig(
  environments: Record<string, { consumer: string; build: { outDir: string } }>,
  watch = false,
  base = '/'
): ResolvedConfig {
  return {
    root: '/repo',
    mode: 'production',
    configFile: '/repo/vite.config.ts',
    publicDir: '/repo/public',
    base,
    plugins: [],
    environments,
    build: {
      outDir: 'dist',
      watch: watch ? {} : null,
      rollupOptions: {},
    },
  } as unknown as ResolvedConfig;
}

async function configuredPlugin(
  environments: Record<string, { consumer: string; build: { outDir: string } }>,
  watch = false,
  base = '/'
): Promise<Plugin> {
  const [plugin, buildAppStart] = withZephyr() as Plugin[];
  await (plugin.configResolved as (config: ResolvedConfig) => void | Promise<void>)(
    resolvedConfig(environments, watch, base)
  );
  await buildAppHandler(buildAppStart)({ environments: {}, build: rs.fn() });
  return plugin;
}

test('rejects unsupported targets before Vite resolves configuration', () => {
  expect(() => withZephyr({ target: 'desktop' as never })).toThrow(
    'withZephyr({ target }) must be one of'
  );
  expect(mocks.deferCreate).not.toHaveBeenCalled();
});

test('passes tap-app into the engine before resolving Vite remotes', async () => {
  const plugin = withZephyr({ target: 'tap-app' })[0] as Plugin;
  await (plugin.configResolved as (config: ResolvedConfig) => void | Promise<void>)(
    resolvedConfig({})
  );

  expect(mocks.deferCreate).toHaveBeenCalledWith({
    builder: 'vite',
    context: '/repo',
    target: 'tap-app',
  });
});

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

interface TestBuildEnvironment {
  isBuilt: boolean;
  config?: { consumer?: string };
}

interface TestBuilder {
  environments: Record<string, TestBuildEnvironment>;
  build: (environment: TestBuildEnvironment) => unknown | Promise<unknown>;
}

type TestWriteBundle = (
  options: { dir?: string; file?: string; format?: string },
  bundle: Record<string, never>
) => Promise<void>;

function writeBundleHandler(plugin: Plugin): TestWriteBundle {
  const hook = plugin.writeBundle!;
  return (typeof hook === 'function' ? hook : hook.handler) as TestWriteBundle;
}

function closeBundleHandler(plugin: Plugin): () => Promise<void> {
  const hook = plugin.closeBundle!;
  return (typeof hook === 'function' ? hook : hook.handler) as () => Promise<void>;
}

function buildAppHandler(plugin: Plugin) {
  return (plugin.buildApp as { handler: (builder: TestBuilder) => Promise<void> })
    .handler;
}

function claimed(
  partialAssetMaps: Record<string, ZeBuildAssetsMap>,
  claimId = 'claim-id'
) {
  return {
    claimId,
    scope: { invocationId: 'test', generation: 0 },
    partialAssetMaps,
  };
}

let internalClaims: ReturnType<typeof claimed>[] = [];

describe('vite-plugin-zephyr', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.viteVersion = '7.0.0';
    mocks.claimPartialAssetMapBatch.mockReset();
    internalClaims = [];
    mocks.claimPartialAssetMapBatch.mockImplementation(
      async (_applicationUid, scopes: Array<{ invocationId: string }>) => {
        if (!scopes[0]?.invocationId.startsWith('vite-')) return undefined;
        const claim = internalClaims.shift();
        return claim ? { claims: [claim] } : undefined;
      }
    );
    mocks.engine.federated_dependencies = [];
    mocks.engine.application_configuration = Promise.resolve({});
    mocks.engine.hasActiveBuild = true;
    mocks.engine.start_new_build.mockImplementation(async () => {
      mocks.engine.hasActiveBuild = true;
    });
    mocks.engine.build_finished.mockImplementation(async () => {
      mocks.engine.hasActiveBuild = false;
    });
    mocks.engine.build_failed.mockImplementation(() => {
      mocks.engine.hasActiveBuild = false;
    });
    mocks.engine.upload_assets.mockResolvedValue(undefined);
    mocks.extractAssets.mockResolvedValue(asset('app.js'));
    delete process.env['ZE_FAIL_BUILD'];
    delete process.env['ZE_BUILD_INVOCATION_ID'];
  });

  afterEach(() => {
    if (originalFailBuild === undefined) delete process.env['ZE_FAIL_BUILD'];
    else process.env['ZE_FAIL_BUILD'] = originalFailBuild;
    if (originalBuildInvocationId === undefined)
      delete process.env['ZE_BUILD_INVOCATION_ID'];
    else process.env['ZE_BUILD_INVOCATION_ID'] = originalBuildInvocationId;
  });

  test('withZephyr without mfConfig does not invoke module federation', () => {
    const plugins = withZephyr();

    expect(mocks.federation).not.toHaveBeenCalled();
    expect(plugins).toHaveLength(2);
    expect(plugins[0]?.name).toBe('with-zephyr');
  });

  test.each(['5.4.21', '6.4.1', '7.0.0', '8.2.2'])(
    'publishes a legacy Vite %s build without waiting for buildApp',
    async (version) => {
      mocks.viteVersion = version;
      const plugin = withZephyr()[0] as Plugin;
      await (plugin.configResolved as (config: ResolvedConfig) => Promise<void>)(
        resolvedConfig({
          client: { consumer: 'client', build: { outDir: 'dist' } },
        })
      );

      await writeBundleHandler(plugin).call(
        { environment: { name: 'client' } },
        { dir: '/repo/dist' },
        {}
      );

      expect(mocks.engine.upload_assets).not.toHaveBeenCalled();
      await closeBundleHandler(plugin)();

      expect(mocks.engine.upload_assets).toHaveBeenCalledTimes(1);
      expect(mocks.engine.build_finished).toHaveBeenCalledTimes(1);
      expect(mocks.savePartialAssetMap).not.toHaveBeenCalled();
    }
  );

  test.each(['multiple environments', 'builder configuration'])(
    'rejects Vite 6 %s before publishing partial output',
    async (scenario) => {
      mocks.viteVersion = '6.4.1';
      process.env['ZE_FAIL_BUILD'] = 'true';
      const config = resolvedConfig({
        client: { consumer: 'client', build: { outDir: 'dist/client' } },
        ...(scenario === 'multiple environments'
          ? { server: { consumer: 'server', build: { outDir: 'dist/server' } } }
          : {}),
      });
      if (scenario === 'builder configuration') {
        config.builder = {} as NonNullable<ResolvedConfig['builder']>;
      }
      const plugin = withZephyr()[0] as Plugin;
      await (plugin.configResolved as (config: ResolvedConfig) => Promise<void>)(config);

      await expect(
        writeBundleHandler(plugin).call(
          { environment: { name: 'client' } },
          { dir: '/repo/dist/client' },
          {}
        )
      ).rejects.toThrow('Vite 7 or newer');
      expect(mocks.engine.upload_assets).not.toHaveBeenCalled();
      expect(mocks.savePartialAssetMap).not.toHaveBeenCalled();
    }
  );

  test('rejects late or unresolved output writers while allowing normal hooks', () => {
    const plugin = withZephyr()[0] as Plugin;
    const outputOptions = plugin.outputOptions as (options: {
      plugins: unknown;
    }) => unknown;
    expect(() =>
      outputOptions({
        plugins: [{ writeBundle: { order: 'post', handler: rs.fn() } }],
      })
    ).toThrow('output-plugin writers');
    expect(() => outputOptions({ plugins: [Promise.resolve({})] })).toThrow(
      'output-plugin writers'
    );
    expect(outputOptions({ plugins: [{ writeBundle: rs.fn() }] })).toBeNull();
    expect(mocks.engine.upload_assets).not.toHaveBeenCalled();
  });

  test('withZephyr injects every mfConfig runtime plugin and delegates to MF', () => {
    mocks.federation.mockImplementation((config) => [
      {
        name: 'module-federation-vite',
        _options: config,
      },
    ]);

    const plugins = withZephyr({
      mfConfig: [{ name: 'host' }, { name: 'worker' }],
    });

    expect(mocks.federation).toHaveBeenCalledTimes(2);
    expect(mocks.federation.mock.calls.map(([config]) => config.runtimePlugins)).toEqual([
      expect.arrayContaining(['virtual:zephyr-mf-runtime-plugin']),
      expect.arrayContaining(['virtual:zephyr-mf-runtime-plugin']),
    ]);
    expect(plugins.map((plugin) => plugin.name)).toEqual([
      'module-federation-vite',
      'module-federation-vite',
      'with-zephyr',
      'with-zephyr:build-app-start',
    ]);
  });

  test('publishes serializable single-container MF metadata on direct uploads', async () => {
    mocks.federation.mockImplementation(() => []);
    const mfConfig = {
      name: 'desktop',
      filename: 'targets/desktop/remoteEntry.mjs',
      library: { type: 'module' },
      manifest: { filePath: 'targets/desktop', fileName: 'mf-manifest' },
      exposes: { './desktop': './src/desktop.ts' },
      shared: { '@tap/sdk': { singleton: true } },
      remotes: { shell: 'shell@https://sdk.example.test/remoteEntry.mjs' },
      getPublicPath: () => '/not-serializable',
    };
    const plugin = withZephyr({ target: 'tap-app', mfConfig })[0] as Plugin;
    await (plugin.configResolved as (config: ResolvedConfig) => void | Promise<void>)(
      resolvedConfig(
        { client: { consumer: 'client', build: { outDir: 'dist/client' } } },
        true
      )
    );
    expect(mfConfig.runtimePlugins).toBeUndefined();
    expect(mocks.engine.resolve_remote_dependencies).not.toHaveBeenCalled();

    await writeBundleHandler(plugin).call(
      { environment: { name: 'client' } },
      { dir: '/repo/dist/client' },
      {}
    );

    const upload = mocks.engine.upload_assets.mock.calls[0]?.[0] as {
      mfConfig?: { name: string; filename: string };
      mfConfigs?: Array<Record<string, unknown>>;
      buildStats: {
        federation?: Array<Record<string, unknown>>;
        remote?: string;
        mf_manifest?: string;
      };
    };
    expect(upload.mfConfig).toEqual(
      expect.objectContaining({
        name: 'desktop',
        filename: 'targets/desktop/remoteEntry.mjs',
      })
    );
    expect(upload.mfConfigs).toHaveLength(1);
    expect(upload.mfConfigs?.[0]).toEqual(
      expect.objectContaining({
        name: 'desktop',
        filename: 'targets/desktop/remoteEntry.mjs',
      })
    );
    expect(upload.mfConfigs?.[0]).not.toBe(mfConfig);
    expect(upload.mfConfigs?.[0]).not.toHaveProperty('getPublicPath');
    expect(upload.buildStats).toEqual(
      expect.objectContaining({
        remote: 'targets/desktop/remoteEntry.mjs',
        mf_manifest: 'targets/desktop/mf-manifest.json',
        federation: [
          expect.objectContaining({
            name: 'desktop',
            remote: 'targets/desktop/remoteEntry.mjs',
            library_type: 'module',
          }),
        ],
      })
    );
  });

  test('publishes every detected Vite MF container as a CSR TAP package', async () => {
    const desktop = {
      name: 'desktop',
      filename: 'targets/desktop/remoteEntry.mjs',
      library: { type: 'module' },
      manifest: { filePath: 'targets/desktop', fileName: 'mf-manifest' },
      exposes: { './desktop': './src/desktop.ts' },
    };
    const worker = {
      name: 'worker',
      filename: 'targets/worker/remoteEntry.mjs',
      library: { type: 'module' },
      manifest: { filePath: 'targets/worker', fileName: 'mf-manifest' },
      exposes: { './worker': './src/worker.ts' },
    };
    const plugin = withZephyr({ target: 'tap-app' })[0] as Plugin;
    const config = resolvedConfig({
      desktop: { consumer: 'client', build: { outDir: 'dist/desktop' } },
      worker: { consumer: 'server', build: { outDir: 'dist/worker' } },
    });
    config.plugins = [
      { name: 'module-federation-vite', _options: desktop },
      { name: 'module-federation-vite', _options: worker },
    ] as unknown as Plugin[];
    await (plugin.configResolved as (config: ResolvedConfig) => void | Promise<void>)(
      config
    );
    internalClaims.push(
      claimed({
        [environmentOutput('desktop')]: asset(
          'targets/desktop/remoteEntry.mjs',
          'desktop-entry'
        ),
        [environmentOutput('worker')]: asset(
          'targets/worker/remoteEntry.mjs',
          'worker-entry'
        ),
      })
    );

    await buildAppHandler(plugin)({
      environments: {
        desktop: { isBuilt: true, config: { consumer: 'client' } },
        worker: { isBuilt: true, config: { consumer: 'server' } },
      },
      build: rs.fn(),
    });

    const upload = mocks.engine.upload_assets.mock.calls[0]?.[0] as {
      mfConfig?: unknown;
      mfConfigs?: Array<{ name?: string; filename?: string }>;
      buildStats: {
        federation?: Array<{ name?: string; remote?: string; mf_manifest?: string }>;
        remote?: string;
      };
      snapshotType?: string;
      entrypoint?: string;
    };
    expect(upload.mfConfig).toBeUndefined();
    expect(upload.mfConfigs).toEqual([
      expect.objectContaining({
        name: 'desktop',
        filename: 'targets/desktop/remoteEntry.mjs',
      }),
      expect.objectContaining({
        name: 'worker',
        filename: 'targets/worker/remoteEntry.mjs',
      }),
    ]);
    expect(upload.buildStats.remote).toBeUndefined();
    expect(upload.snapshotType).toBe('csr');
    expect(upload.entrypoint).toBeUndefined();
    expect(upload.buildStats.federation).toEqual([
      expect.objectContaining({
        name: 'desktop',
        remote: 'targets/desktop/remoteEntry.mjs',
        mf_manifest: 'targets/desktop/mf-manifest.json',
      }),
      expect.objectContaining({
        name: 'worker',
        remote: 'targets/worker/remoteEntry.mjs',
        mf_manifest: 'targets/worker/mf-manifest.json',
      }),
    ]);
  });

  test('does not conflict when withZephyr({ mfConfig }) also surfaces a normalized MF plugin', async () => {
    // Regression: `withZephyr({ mfConfig })` injects the @module-federation/vite
    // plugin from the same config. That plugin later reports a normalized `_options`
    // (expanded `exposes`/`shared`, extra MF defaults) that shares the container
    // identity of the source config. Registering both must not trip the publication
    // conflict guard. https://github.com/ZephyrCloudIO/zephyr-packages (mfConfig dedupe)
    const mfConfig = {
      name: 'vite_remote',
      filename: 'remoteEntry.js',
      exposes: { './Button': './src/Button' },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
    };
    // Model @module-federation/vite normalizing the config it was handed.
    mocks.federation.mockImplementation((config) => [
      {
        name: 'module-federation-vite',
        _options: {
          name: config.name,
          filename: config.filename,
          exposes: { './Button': { import: './src/Button' } },
          shared: {
            react: {
              name: 'react',
              version: '19.2.5',
              shareConfig: { singleton: true, requiredVersion: '^19.2.5' },
            },
            'react-dom': {
              name: 'react-dom',
              version: '19.2.5',
              shareConfig: { singleton: true, requiredVersion: '^19.2.5' },
            },
          },
          runtimePlugins: config.runtimePlugins,
          shareScope: 'default',
          manifest: false,
        },
      },
    ]);

    const plugins = withZephyr({ mfConfig }) as Plugin[];
    const plugin = plugins.find((candidate) => candidate.name === 'with-zephyr')!;
    const config = resolvedConfig({
      client: { consumer: 'client', build: { outDir: 'dist/client' } },
    });
    // The federation plugin injected by withZephyr() is present in the resolved config,
    // reporting the normalized `_options` for the same container.
    config.plugins = plugins.filter(
      (candidate) => candidate.name === 'module-federation-vite'
    );

    // Before the fix this rejected with
    // "Conflicting Vite Module Federation configuration for name:vite_remote".
    await expect(
      (plugin.configResolved as (config: ResolvedConfig) => void | Promise<void>)(config)
    ).resolves.not.toThrow();

    // withZephyr() injected the federation plugin exactly once from `mfConfig`.
    expect(mocks.federation).toHaveBeenCalledTimes(1);
  });

  test('emits the generated manifest for conventional Vite builds', async () => {
    const plugin = withZephyr()[0] as Plugin;
    const emitFile = rs.fn();

    await (plugin.generateBundle as unknown as () => Promise<void>).call({ emitFile });

    expect(emitFile).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'asset',
        fileName: 'zephyr-manifest.json',
      })
    );
  });

  test('keeps an SDK-owned TAP manifest from public/static output without regeneration', async () => {
    const sdkStaticManifest = asset('zephyr-manifest.json', 'sdk-manifest-lock');
    sdkStaticManifest['sdk-manifest-lock']!.buffer = '{"sdk":"locked"}';
    const plugin = withZephyr({ target: 'tap-app' })[0] as Plugin;
    const config = resolvedConfig(
      { client: { consumer: 'client', build: { outDir: 'dist/client' } } },
      true
    );
    config.plugins = [
      {
        name: 'module-federation-vite',
        _options: {
          name: 'desktop',
          filename: 'targets/desktop/remoteEntry.mjs',
        },
      },
    ] as unknown as Plugin[];
    await (plugin.configResolved as (config: ResolvedConfig) => void | Promise<void>)(
      config
    );
    mocks.extractAssets.mockResolvedValue(sdkStaticManifest);
    const emitFile = rs.fn();

    await (plugin.generateBundle as unknown as () => Promise<void>).call({ emitFile });
    await writeBundleHandler(plugin).call(
      { environment: { name: 'client' } },
      { dir: '/repo/dist/client' },
      {}
    );

    expect(emitFile).not.toHaveBeenCalled();
    const upload = mocks.engine.upload_assets.mock.calls[0]?.[0] as {
      assetsMap: ZeBuildAssetsMap;
    };
    expect(upload.assetsMap).toBe(sdkStaticManifest);
    expect(upload.assetsMap['sdk-manifest-lock']).toEqual(
      expect.objectContaining({
        path: 'zephyr-manifest.json',
        buffer: '{"sdk":"locked"}',
      })
    );
  });

  test('rejects entrypoints that escape the snapshot root', async () => {
    const plugin = withZephyr({ entrypoint: '../secret.js' })[0] as Plugin;
    await expect(
      (plugin.configResolved as (config: ResolvedConfig) => void | Promise<void>)(
        resolvedConfig({})
      )
    ).rejects.toThrow('relative path inside the snapshot');
  });

  test('owns Vite default buildApp orchestration only when no environment was built', async () => {
    const plugin = await configuredPlugin({
      browser: { consumer: 'client', build: { outDir: 'dist/client' } },
      runtime: { consumer: 'server', build: { outDir: 'dist/server' } },
    });
    const environments = {
      browser: { isBuilt: false, config: { consumer: 'client' } },
      runtime: { isBuilt: false, config: { consumer: 'server' } },
    };
    const build = rs.fn(async (environment: { isBuilt: boolean }) => {
      environment.isBuilt = true;
    });
    internalClaims.push(
      claimed({
        [environmentOutput('browser')]: asset('client/app.js', 'client'),
        [environmentOutput('runtime')]: asset('server/index.mjs', 'server'),
      })
    );

    await buildAppHandler(plugin)({ environments, build });

    expect(build).toHaveBeenCalledTimes(2);
    expect(mocks.engine.upload_assets).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotType: 'ssr',
        entrypoint: 'server/index.mjs',
      })
    );
  });

  test('propagates normalized Vite base to snapshot assets', async () => {
    const plugin = await configuredPlugin(
      { browser: { consumer: 'client', build: { outDir: 'dist/client' } } },
      false,
      '/base-path/'
    );
    internalClaims.push(
      claimed({ [environmentOutput('browser')]: asset('vite.svg', 'svg') })
    );

    await buildAppHandler(plugin)({
      environments: { browser: { isBuilt: true, config: { consumer: 'client' } } },
      build: rs.fn(),
    });

    expect(mocks.engine.buildProperties.baseHref).toBe('base-path');
    const addressed = applyBaseHrefToAssets(
      asset('vite.svg', 'svg'),
      mocks.engine.buildProperties.baseHref
    );
    expect(Object.values(addressed)[0]?.path).toBe('base-path/vite.svg');
    expect(mocks.commitPartialAssetMapClaimBatch).toHaveBeenCalledWith(
      mocks.engine.application_uid,
      ['claim-id']
    );
  });

  test('rewrites generated env imports through renderChunk without mutating bundle output', async () => {
    const plugin = await configuredPlugin({});
    await (plugin.resolveId as (source: string) => Promise<unknown>)('entry.js');
    const renderChunk = (
      plugin.renderChunk as {
        handler: (code: string) => { code: string; map: null } | null;
      }
    ).handler;
    const code =
      "import zephyrEnv from 'env:vars:org.project.vite';\nconsole.log(zephyrEnv);";

    const result = renderChunk(code);

    expect(result?.code).toContain(
      "from 'env:vars:org.project.vite' with { type: 'json' }"
    );
    expect(code).not.toContain("with { type: 'json' }");
  });

  test('does not rewrite locked tap-app source or rendered chunks', async () => {
    const plugin = withZephyr({ target: 'tap-app' })[0] as Plugin;
    const transform = (
      plugin.transform as {
        handler: (code: string, id: string) => Promise<{ code: string } | null>;
      }
    ).handler;
    const source = 'console.log(import.meta.env.ZE_PUBLIC_TOKEN);';

    expect(await transform(source, '/repo/src/app.ts')).toBeNull();

    await (plugin.configResolved as (config: ResolvedConfig) => void | Promise<void>)(
      resolvedConfig({})
    );
    await (plugin.resolveId as (source: string) => Promise<unknown>)('entry.js');
    const renderChunk = (
      plugin.renderChunk as {
        handler: (code: string) => { code: string; map: null } | null;
      }
    ).handler;
    const generated =
      "import zephyrEnv from 'env:vars:org.project.vite';\nconsole.log(zephyrEnv);";

    expect(renderChunk(generated)).toBeNull();
    expect(generated).not.toContain("with { type: 'json' }");
  });

  test('does not force a framework-owned subset of incomplete environments', async () => {
    process.env['ZE_FAIL_BUILD'] = 'true';
    const plugin = await configuredPlugin({
      client: { consumer: 'client', build: { outDir: 'dist/client' } },
      server: { consumer: 'server', build: { outDir: 'dist/server' } },
    });
    const build = rs.fn();

    await expect(
      buildAppHandler(plugin)({
        environments: {
          client: { isBuilt: true, config: { consumer: 'client' } },
          server: { isBuilt: false, config: { consumer: 'server' } },
        },
        build,
      })
    ).rejects.toThrow('server');
    expect(build).not.toHaveBeenCalled();
    expect(mocks.engine.upload_assets).not.toHaveBeenCalled();
  });

  test('requires every current environment map despite isBuilt and rejects stale environment maps', async () => {
    process.env['ZE_FAIL_BUILD'] = 'true';
    const config = {
      client: { consumer: 'client', build: { outDir: 'dist/client' } },
      server: { consumer: 'server', build: { outDir: 'dist/server' } },
    };
    const environments = {
      client: { isBuilt: true, config: { consumer: 'client' } },
      server: { isBuilt: true, config: { consumer: 'server' } },
    };

    const missingPlugin = await configuredPlugin(config);
    internalClaims.push(
      claimed({
        [environmentOutput('client')]: asset('client/app.js'),
      })
    );
    await expect(
      buildAppHandler(missingPlugin)({ environments, build: rs.fn() })
    ).rejects.toThrow('vite-environment:server');

    const stalePlugin = await configuredPlugin(config);
    internalClaims.push(
      claimed({
        [environmentOutput('client')]: asset('client/app.js'),
        [environmentOutput('server')]: asset('server/index.js'),
        [environmentOutput('previous-server')]: asset('old/index.js'),
      })
    );
    await expect(
      buildAppHandler(stalePlugin)({ environments, build: rs.fn() })
    ).rejects.toThrow('previous-server');
    expect(mocks.engine.upload_assets).not.toHaveBeenCalled();
  });

  test('persists and merges every output emitted by one Vite environment', async () => {
    const plugin = await configuredPlugin({
      client: { consumer: 'client', build: { outDir: 'dist/client' } },
    });
    const writeBundle = writeBundleHandler(plugin);
    const context = { environment: { name: 'client' } };
    mocks.extractAssets
      .mockResolvedValueOnce(asset('client/app.mjs', 'esm-output'))
      .mockResolvedValueOnce(asset('client/app.cjs', 'cjs-output'));

    await writeBundle.call(context, { dir: '/repo/dist/client', format: 'es' }, {});
    await writeBundle.call(context, { dir: '/repo/dist/client', format: 'cjs' }, {});

    const persistedOutputs = Object.fromEntries(
      mocks.savePartialAssetMap.mock.calls.map(([, key, assetsMap]) => [key, assetsMap])
    ) as Record<string, ZeBuildAssetsMap>;
    expect(Object.keys(persistedOutputs)).toHaveLength(2);
    expect(Object.keys(persistedOutputs)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^vite-environment:client:[a-f0-9]{64}$/),
        expect.stringMatching(/^vite-environment:client:[a-f0-9]{64}$/),
      ])
    );
    internalClaims.push(claimed(persistedOutputs));

    await buildAppHandler(plugin)({
      environments: {
        client: { isBuilt: true, config: { consumer: 'client' } },
      },
      build: rs.fn(),
    });

    expect(mocks.engine.upload_assets).toHaveBeenCalledWith(
      expect.objectContaining({
        assetsMap: expect.objectContaining({
          'esm-output': expect.objectContaining({ path: 'client/app.mjs' }),
          'cjs-output': expect.objectContaining({ path: 'client/app.cjs' }),
        }),
      })
    );
  });

  test('preserves tap-app locked assets across separate environment output directories', async () => {
    const environments = {
      desktop: { consumer: 'client', build: { outDir: 'dist/tap/desktop' } },
      worker: { consumer: 'client', build: { outDir: 'dist/tap/worker' } },
    };
    const [plugin, buildAppStart] = withZephyr({ target: 'tap-app' }) as Plugin[];
    await (plugin.configResolved as (config: ResolvedConfig) => void | Promise<void>)(
      resolvedConfig(environments)
    );
    await buildAppHandler(buildAppStart)({ environments: {}, build: rs.fn() });
    const writeBundle = writeBundleHandler(plugin);
    const desktopAssets = asset('sdk/desktop/runtime.js', 'desktop-sdk-lock');
    const workerAssets = asset('sdk/worker/runtime.js', 'worker-sdk-lock');
    desktopAssets['desktop-sdk-lock']!.buffer = 'desktop SDK bytes';
    workerAssets['worker-sdk-lock']!.buffer = 'worker SDK bytes';
    mocks.extractAssets
      .mockResolvedValueOnce(desktopAssets)
      .mockResolvedValueOnce(workerAssets);

    await writeBundle.call(
      { environment: { name: 'desktop' } },
      { dir: '/repo/dist/tap/desktop' },
      {}
    );
    await writeBundle.call(
      { environment: { name: 'worker' } },
      { dir: '/repo/dist/tap/worker' },
      {}
    );

    const persistedAssetsMaps = mocks.savePartialAssetMap.mock.calls.map(
      (call) => call[2]
    ) as ZeBuildAssetsMap[];
    expect(persistedAssetsMaps).toEqual([desktopAssets, workerAssets]);
    expect(persistedAssetsMaps[0]).toBe(desktopAssets);
    expect(persistedAssetsMaps[1]).toBe(workerAssets);
    expect(persistedAssetsMaps[0]?.['desktop-sdk-lock']).toEqual(
      expect.objectContaining({
        path: 'sdk/desktop/runtime.js',
        buffer: 'desktop SDK bytes',
      })
    );
    expect(persistedAssetsMaps[1]?.['worker-sdk-lock']).toEqual(
      expect.objectContaining({
        path: 'sdk/worker/runtime.js',
        buffer: 'worker SDK bytes',
      })
    );
  });

  test('prefixes generic multi-environment assets by their output directory', async () => {
    const plugin = await configuredPlugin({
      desktop: { consumer: 'client', build: { outDir: 'dist/tap/desktop' } },
      worker: { consumer: 'client', build: { outDir: 'dist/tap/worker' } },
    });
    const writeBundle = writeBundleHandler(plugin);
    mocks.extractAssets
      .mockResolvedValueOnce(asset('sdk/runtime.js', 'desktop-sdk'))
      .mockResolvedValueOnce(asset('sdk/runtime.js', 'worker-sdk'));

    await writeBundle.call(
      { environment: { name: 'desktop' } },
      { dir: '/repo/dist/tap/desktop' },
      {}
    );
    await writeBundle.call(
      { environment: { name: 'worker' } },
      { dir: '/repo/dist/tap/worker' },
      {}
    );

    const persistedAssetsMaps = mocks.savePartialAssetMap.mock.calls.map(
      (call) => call[2]
    ) as ZeBuildAssetsMap[];
    expect(Object.values(persistedAssetsMaps[0] ?? {})[0]).toEqual(
      expect.objectContaining({ path: 'desktop/sdk/runtime.js' })
    );
    expect(Object.values(persistedAssetsMaps[1] ?? {})[0]).toEqual(
      expect.objectContaining({ path: 'worker/sdk/runtime.js' })
    );
  });

  test('rejects path collisions across outputs from one Vite environment', async () => {
    process.env['ZE_FAIL_BUILD'] = 'true';
    const plugin = await configuredPlugin({
      client: { consumer: 'client', build: { outDir: 'dist/client' } },
    });
    const writeBundle = writeBundleHandler(plugin);
    const context = { environment: { name: 'client' } };
    mocks.extractAssets
      .mockResolvedValueOnce(asset('client/app.js', 'first-output'))
      .mockResolvedValueOnce(asset('client/app.js', 'second-output'));

    await writeBundle.call(context, { dir: '/repo/dist/client', format: 'es' }, {});
    await writeBundle.call(context, { dir: '/repo/dist/client', format: 'cjs' }, {});
    internalClaims.push(
      claimed(
        Object.fromEntries(
          mocks.savePartialAssetMap.mock.calls.map(([, key, assetsMap]) => [
            key,
            assetsMap,
          ])
        ) as Record<string, ZeBuildAssetsMap>
      )
    );

    await expect(
      buildAppHandler(plugin)({
        environments: {
          client: { isBuilt: true, config: { consumer: 'client' } },
        },
        build: rs.fn(),
      })
    ).rejects.toThrow('Conflicting assets were contributed');
  });

  test('requires configured external partial output in the same atomic claim batch', async () => {
    process.env['ZE_FAIL_BUILD'] = 'true';
    const plugin = withZephyr({
      partialBuild: { invocationId: 'external-build', generation: 2 },
    })[0] as Plugin;
    await (plugin.configResolved as (config: ResolvedConfig) => void | Promise<void>)(
      resolvedConfig({
        client: { consumer: 'client', build: { outDir: 'dist/client' } },
      })
    );

    await expect(
      buildAppHandler(plugin)({
        environments: {
          client: { isBuilt: true, config: { consumer: 'client' } },
        },
        build: rs.fn(),
      })
    ).rejects.toThrow('atomically claim');

    expect(mocks.claimPartialAssetMapBatch).toHaveBeenCalledWith(
      mocks.engine.application_uid,
      expect.arrayContaining([
        expect.objectContaining({ invocationId: expect.stringMatching(/^vite-/) }),
        { invocationId: 'external-build', generation: 2 },
      ])
    );
    expect(mocks.engine.upload_assets).not.toHaveBeenCalled();
  });

  test('uses the dedicated invocation contract without a partialBuild option', async () => {
    process.env['ZE_FAIL_BUILD'] = 'true';
    process.env['ZE_BUILD_INVOCATION_ID'] = 'external-build';
    const plugin = withZephyr()[0] as Plugin;
    await (plugin.configResolved as (config: ResolvedConfig) => void | Promise<void>)(
      resolvedConfig({
        client: { consumer: 'client', build: { outDir: 'dist/client' } },
      })
    );

    await expect(
      buildAppHandler(plugin)({
        environments: {
          client: { isBuilt: true, config: { consumer: 'client' } },
        },
        build: rs.fn(),
      })
    ).rejects.toThrow('atomically claim');

    expect(mocks.claimPartialAssetMapBatch).toHaveBeenCalledWith(
      mocks.engine.application_uid,
      expect.arrayContaining([
        expect.objectContaining({ invocationId: expect.stringMatching(/^vite-/) }),
        { invocationId: 'external-build', generation: 0 },
      ])
    );
  });

  test('does not treat ambient CI metadata as an external partial build', async () => {
    await withProcessEnv(
      {
        GITHUB_RUN_ID: '12345',
        GITHUB_RUN_ATTEMPT: '2',
        GITHUB_JOB: 'build',
      },
      async () => {
        const plugin = await configuredPlugin({
          client: { consumer: 'client', build: { outDir: 'dist/client' } },
        });
        internalClaims.push(
          claimed({ [environmentOutput('client')]: asset('client/app.js') })
        );

        await buildAppHandler(plugin)({
          environments: {
            client: { isBuilt: true, config: { consumer: 'client' } },
          },
          build: rs.fn(),
        });

        expect(mocks.claimPartialAssetMapBatch).toHaveBeenCalledWith(
          mocks.engine.application_uid,
          [
            {
              invocationId: expect.stringMatching(/^vite-/),
              generation: 0,
            },
          ]
        );
        expect(mocks.engine.upload_assets).toHaveBeenCalledTimes(1);
      }
    );
  });

  test('uses CI metadata after the finalizer explicitly opts into partial output', async () => {
    await withProcessEnv(
      {
        GITHUB_RUN_ID: '12345',
        GITHUB_RUN_ATTEMPT: '2',
        GITHUB_JOB: 'build',
      },
      async () => {
        process.env['ZE_FAIL_BUILD'] = 'true';
        const plugin = withZephyr({ partialBuild: {} })[0] as Plugin;
        await (plugin.configResolved as (config: ResolvedConfig) => void | Promise<void>)(
          resolvedConfig({
            client: { consumer: 'client', build: { outDir: 'dist/client' } },
          })
        );

        await expect(
          buildAppHandler(plugin)({
            environments: {
              client: { isBuilt: true, config: { consumer: 'client' } },
            },
            build: rs.fn(),
          })
        ).rejects.toThrow('atomically claim');

        expect(mocks.claimPartialAssetMapBatch).toHaveBeenCalledWith(
          mocks.engine.application_uid,
          expect.arrayContaining([
            expect.objectContaining({ invocationId: expect.stringMatching(/^vite-/) }),
            { invocationId: '12345:2:build', generation: 0 },
          ])
        );
      }
    );
  });

  test('allows non-environment partial maps and infers SSR from consumer metadata', async () => {
    const plugin = await configuredPlugin({
      web: { consumer: 'client', build: { outDir: 'dist/web' } },
      oddlyNamed: { consumer: 'server', build: { outDir: 'dist/runtime' } },
    });
    internalClaims.push(
      claimed({
        [environmentOutput('web')]: asset('web/app.js', 'web'),
        [environmentOutput('oddlyNamed')]: asset('runtime/index.cjs', 'runtime'),
        'vite-partial:prerender': asset('prerender/routes.json', 'prerender'),
      })
    );

    await buildAppHandler(plugin)({
      environments: {
        web: { isBuilt: true, config: { consumer: 'client' } },
        oddlyNamed: { isBuilt: true, config: { consumer: 'server' } },
      },
      build: rs.fn(),
    });

    expect(mocks.engine.upload_assets).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotType: 'ssr',
        entrypoint: 'runtime/index.cjs',
        assetsMap: expect.objectContaining({ prerender: expect.any(Object) }),
      })
    );
  });

  test('starts a fresh direct-upload generation for each single-environment watch rebuild', async () => {
    const plugin = await configuredPlugin(
      { client: { consumer: 'client', build: { outDir: 'dist/client' } } },
      true
    );
    const writeBundle = writeBundleHandler(plugin);
    mocks.extractAssets
      .mockResolvedValueOnce(asset('app-0.js', 'generation-0'))
      .mockResolvedValueOnce(asset('app-1.js', 'generation-1'));
    const context = { environment: { name: 'client' } };

    await writeBundle.call(context, { dir: '/repo/dist/client' }, {});
    await writeBundle.call(context, { dir: '/repo/dist/client' }, {});

    expect(mocks.engine.upload_assets).toHaveBeenCalledTimes(2);
    expect(mocks.engine.build_finished).toHaveBeenCalledTimes(2);
    expect(mocks.engine.start_new_build).toHaveBeenCalledTimes(1);
  });

  test('starts a fresh direct build after a failed watch upload is retried', async () => {
    process.env['ZE_FAIL_BUILD'] = 'true';
    const plugin = await configuredPlugin(
      { client: { consumer: 'client', build: { outDir: 'dist/client' } } },
      true
    );
    const writeBundle = writeBundleHandler(plugin);
    const error = new Error('first upload failed');
    mocks.engine.upload_assets.mockRejectedValueOnce(error).mockResolvedValue(undefined);
    const context = { environment: { name: 'client' } };

    await expect(
      writeBundle.call(context, { dir: '/repo/dist/client' }, {})
    ).rejects.toBe(error);
    await expect(
      writeBundle.call(context, { dir: '/repo/dist/client' }, {})
    ).resolves.toBeUndefined();

    expect(mocks.engine.upload_assets).toHaveBeenCalledTimes(2);
    expect(mocks.engine.start_new_build).toHaveBeenCalledTimes(1);
    expect(mocks.engine.build_finished).toHaveBeenCalledTimes(1);
  });

  test('allocates a new coordinated generation after publication failure', async () => {
    process.env['ZE_FAIL_BUILD'] = 'true';
    const plugin = await configuredPlugin({
      client: { consumer: 'client', build: { outDir: 'dist/client' } },
    });
    const environmentAssets = {
      [environmentOutput('client')]: asset('client/app.js'),
    };
    internalClaims.push(
      claimed(environmentAssets, 'claim-0'),
      claimed(environmentAssets, 'claim-1')
    );
    const error = new Error('first coordinated upload failed');
    mocks.engine.upload_assets.mockRejectedValueOnce(error).mockResolvedValue(undefined);
    const builder = {
      environments: {
        client: { isBuilt: true, config: { consumer: 'client' } },
      },
      build: rs.fn(),
    };

    await expect(buildAppHandler(plugin)(builder)).rejects.toBe(error);
    await expect(buildAppHandler(plugin)(builder)).resolves.toBeUndefined();

    const generations = mocks.claimPartialAssetMapBatch.mock.calls.map(
      (call) => call[1][0].generation
    );
    expect(generations).toEqual([0, 1]);
    expect(mocks.engine.upload_assets).toHaveBeenCalledTimes(2);
    expect(mocks.engine.start_new_build).toHaveBeenCalledTimes(1);
    expect(mocks.commitPartialAssetMapClaimBatch).toHaveBeenCalledWith(
      mocks.engine.application_uid,
      ['claim-1']
    );
  });

  test('rolls back a persisted claim when coordinated publication fails', async () => {
    process.env['ZE_FAIL_BUILD'] = 'true';
    const plugin = await configuredPlugin({
      client: { consumer: 'client', build: { outDir: 'dist/client' } },
    });
    internalClaims.push(
      claimed({ [environmentOutput('client')]: asset('client/app.js') })
    );
    mocks.engine.upload_assets.mockRejectedValue(new Error('production upload failed'));

    await expect(
      buildAppHandler(plugin)({
        environments: { client: { isBuilt: true, config: { consumer: 'client' } } },
        build: rs.fn(),
      })
    ).rejects.toThrow('production upload failed');

    expect(mocks.rollbackPartialAssetMapClaimBatch).toHaveBeenCalledWith(
      mocks.engine.application_uid,
      ['claim-id']
    );
    expect(mocks.commitPartialAssetMapClaimBatch).not.toHaveBeenCalled();
  });
});

describe('withZephyrPartial', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    delete process.env['ZE_FAIL_BUILD'];
    delete process.env['ZE_BUILD_INVOCATION_ID'];
  });

  afterEach(() => {
    if (originalFailBuild === undefined) delete process.env['ZE_FAIL_BUILD'];
    else process.env['ZE_FAIL_BUILD'] = originalFailBuild;
    if (originalBuildInvocationId === undefined)
      delete process.env['ZE_BUILD_INVOCATION_ID'];
    else process.env['ZE_BUILD_INVOCATION_ID'] = originalBuildInvocationId;
  });

  test('isolates concurrent environment extraction and persisted keys by output root', async () => {
    const clientOutput = path.resolve('/repo/dist/client');
    const serverOutput = path.resolve('/repo/dist/server');
    const seenOptions: Array<{ outDir: string }> = [];
    mocks.extractAssets.mockImplementation(async (_engine, options) => {
      seenOptions.push(options);
      await Promise.resolve();
      return asset(`${options.outDir}/app.js`);
    });
    const plugin = withZephyrPartial({ invocationId: 'test-partial' });
    await (plugin.configResolved as (config: ResolvedConfig) => void | Promise<void>)(
      resolvedConfig({})
    );
    const writeBundle = writeBundleHandler(plugin);

    await Promise.all([
      writeBundle.call({ environment: { name: 'client' } }, { dir: clientOutput }, {}),
      writeBundle.call({ environment: { name: 'server' } }, { dir: serverOutput }, {}),
    ]);

    expect(seenOptions.map(({ outDir }) => outDir).sort()).toEqual(
      [clientOutput, serverOutput].sort()
    );
    const keys = mocks.savePartialAssetMap.mock.calls.map((call) => call[1]);
    expect(new Set(keys).size).toBe(2);
    expect(keys).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`client:${clientOutput.replace(/\\/g, '/')}`),
        expect.stringContaining(`server:${serverOutput.replace(/\\/g, '/')}`),
      ])
    );
  });

  test('propagates tap-app target into an independent partial producer', async () => {
    const seenOptions: Array<{ target?: string }> = [];
    mocks.extractAssets.mockImplementation(async (_engine, options) => {
      seenOptions.push(options);
      return asset('targets/desktop/remoteEntry.mjs');
    });
    const plugin = withZephyrPartial({
      invocationId: 'tap-partial',
      target: 'tap-app',
    });
    await (plugin.configResolved as (config: ResolvedConfig) => void | Promise<void>)(
      resolvedConfig({})
    );

    await writeBundleHandler(plugin).call(
      { environment: { name: 'desktop' } },
      { dir: '/repo/dist/desktop' },
      {}
    );

    expect(mocks.deferCreate).toHaveBeenCalledWith({
      builder: 'vite',
      context: '/repo',
      target: 'tap-app',
    });
    expect(seenOptions).toEqual([expect.objectContaining({ target: 'tap-app' })]);
  });

  test('propagates extraction failures when ZE_FAIL_BUILD is enabled', async () => {
    process.env['ZE_FAIL_BUILD'] = 'true';
    const error = new Error('partial extraction failed');
    mocks.extractAssets.mockRejectedValue(error);
    const plugin = withZephyrPartial({ invocationId: 'test-partial' });
    await (plugin.configResolved as (config: ResolvedConfig) => void | Promise<void>)(
      resolvedConfig({})
    );

    await expect(
      writeBundleHandler(plugin).call(
        { environment: { name: 'client' } },
        { dir: '/repo/dist/client' },
        {}
      )
    ).rejects.toThrow('partial extraction failed');
    expect(mocks.savePartialAssetMap).not.toHaveBeenCalled();
  });
});
