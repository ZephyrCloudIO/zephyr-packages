import type { ModuleFederationRuntimePlugin } from '@module-federation/runtime';
import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { ZephyrNativeCacheRefs } from 'zephyr-edge-contract';

import type { EmbeddedRemoteRuntime } from '../lib/embed-remotes';
import {
  createEmbeddedRemotesPlugin,
  type RepackLoadHook,
} from './embedded-remotes-plugin';

type ErrorLoadRemoteArgs = Parameters<
  NonNullable<ModuleFederationRuntimePlugin['errorLoadRemote']>
>[0];
type LoadRemoteSnapshotArgs = Parameters<
  NonNullable<ModuleFederationRuntimePlugin['loadRemoteSnapshot']>
>[0];

const MANIFEST_URL = 'https://cdn.example/cart/mf-manifest.json';
const CARD_FILE = 'zephyr-remote-0123456789abcdef-Card.bundle';
const CONTAINER_FILE = 'zephyr-remote-fedcba9876543210-cart.container.js.bundle';
const CHUNK_FILE = 'zephyr-remote-00112233445566aa-src_Card.chunk.bundle';

const stored = new Map<string, string>();
let warn: ReturnType<typeof rs.spyOn>;

function metroRemote(): EmbeddedRemoteRuntime {
  return {
    name: 'cart',
    globalName: 'cart',
    manifestUrl: MANIFEST_URL,
    manifest: {
      metaData: {
        publicPath: 'auto',
        getPublicPath: 'return "x"',
        buildInfo: { hash: 'embedded-hash' },
        remoteEntry: { name: 'remoteEntry.bundle', path: '' },
      },
      exposes: [{ name: 'Card' }],
      shared: [],
    },
    files: {
      'remoteEntry.bundle': 'zephyr-remote-aa-remoteEntry.bundle',
      'exposed/Card.bundle': CARD_FILE,
    },
  };
}

function repackRemote(): EmbeddedRemoteRuntime {
  return {
    name: 'cart',
    globalName: 'cart',
    manifestUrl: MANIFEST_URL,
    manifest: { metaData: { publicPath: 'auto' }, exposes: [], shared: [] },
    files: {
      'cart.container.js.bundle': CONTAINER_FILE,
      'src_Card.chunk.bundle': CHUNK_FILE,
    },
  };
}

function installNativeCache(refs: ZephyrNativeCacheRefs): void {
  globalThis.__ZEPHYR__ = { version: 1, runtime: { nativeCache: { refs } } };
  globalThis.__FEDERATION__ = {
    __NATIVE__: { __CACHE__: async () => undefined },
  } as unknown as typeof globalThis.__FEDERATION__;
}

function envStorage(): ZephyrNativeCacheRefs['envStorage'] {
  return {
    getItem: async (key) => stored.get(key),
    setItem: async (key, value) => {
      stored.set(key, value);
    },
  };
}

function manifestFailure(): ErrorLoadRemoteArgs {
  return {
    id: MANIFEST_URL,
    error: new Error('Network request failed'),
    from: 'runtime',
    lifecycle: 'afterResolve',
    remote: { name: 'cart', entry: MANIFEST_URL },
  } as unknown as ErrorLoadRemoteArgs;
}

beforeEach(() => {
  rs.restoreAllMocks();
  globalThis.__ZEPHYR__ = undefined;
  globalThis.__FEDERATION__ = undefined as never;
  stored.clear();
  warn = rs.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('Metro', () => {
  it('returns the embedded manifest under the embedded origin', async () => {
    installNativeCache({ readBundledFile: async () => '', envStorage: envStorage() });
    const plugin = createEmbeddedRemotesPlugin([metroRemote()], { bundler: 'metro' });

    const manifest = (await plugin.errorLoadRemote?.(manifestFailure())) as {
      metaData: Record<string, unknown>;
    };

    expect(manifest.metaData['publicPath']).toBe('https://zephyr-embedded.invalid/cart/');
    expect('getPublicPath' in manifest.metaData).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      '[zephyr-embed] cart: network unavailable; using the copy embedded in the app'
    );
  });

  it('warns and leaves the failure alone without zephyr-native-cache', async () => {
    const plugin = createEmbeddedRemotesPlugin([metroRemote()], { bundler: 'metro' });

    expect(await plugin.errorLoadRemote?.(manifestFailure())).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('zephyr-native-cache is not registered')
    );
  });

  it('prefers the persisted manifest when its container is cached', async () => {
    const persisted = {
      metaData: {
        publicPath: 'https://cdn.example/cart/v2/',
        buildInfo: { hash: 'h2' },
        remoteEntry: { name: 'remoteEntry.bundle', path: '' },
      },
    };
    stored.set(`mf-manifest:${MANIFEST_URL}`, JSON.stringify(persisted));
    const hasCachedBundle = rs.fn(async () => true);
    installNativeCache({
      readBundledFile: async () => '',
      envStorage: envStorage(),
      hasCachedBundle,
    });
    const plugin = createEmbeddedRemotesPlugin([metroRemote()], { bundler: 'metro' });

    expect(await plugin.errorLoadRemote?.(manifestFailure())).toEqual(persisted);
    expect(hasCachedBundle).toHaveBeenCalledWith(
      'https://cdn.example/cart/v2/remoteEntry.bundle',
      'h2'
    );
  });

  it('persists manifests loaded from the network', async () => {
    installNativeCache({ envStorage: envStorage() });
    const plugin = createEmbeddedRemotesPlugin([metroRemote()], { bundler: 'metro' });
    const manifestJson = { metaData: { buildInfo: { hash: 'h3' } } };

    await plugin.loadRemoteSnapshot?.({
      from: 'manifest',
      manifestUrl: MANIFEST_URL,
      manifestJson,
      moduleInfo: { name: 'cart', entry: MANIFEST_URL },
    } as unknown as LoadRemoteSnapshotArgs);
    await Promise.resolve();

    expect(stored.get(`mf-manifest:${MANIFEST_URL}`)).toBe(JSON.stringify(manifestJson));
  });

  it('evaluates embedded bundles and reports the load', async () => {
    const recordEmbeddedLoad = rs.fn();
    const readBundledFile = rs.fn(async () => 'globalThis.__EMBED_TEST__ = "card";');
    installNativeCache({ readBundledFile, recordEmbeddedLoad });
    createEmbeddedRemotesPlugin([metroRemote()], { bundler: 'metro' });
    const url =
      'https://zephyr-embedded.invalid/cart/exposed/Card.bundle?modulesOnly=true';

    const embedded = globalThis.__ZEPHYR__?.runtime.embeddedRemotes;
    expect(embedded?.owns(url)).toBe(true);
    await embedded?.load(url);

    expect(readBundledFile).toHaveBeenCalledWith(CARD_FILE);
    expect((globalThis as Record<string, unknown>)['__EMBED_TEST__']).toBe('card');
    expect(recordEmbeddedLoad).toHaveBeenCalledWith(url, 'cart');
    Reflect.deleteProperty(globalThis, '__EMBED_TEST__');
  });
});

describe('Re.Pack', () => {
  function setUp(): RepackLoadHook {
    let hook: RepackLoadHook | undefined;
    const plugin = createEmbeddedRemotesPlugin([repackRemote()], {
      bundler: 'repack',
      getScriptManager: () => ({ hooks: { load: (fn) => (hook = fn) } }),
    });
    plugin.beforeInit?.({} as never);
    if (!hook) throw new Error('load hook not installed');
    return hook;
  }

  it('loads the embedded container when the network container fails', async () => {
    const hook = setUp();
    const loadScript = rs.fn(async (scriptId?: string, _locator?: object) => {
      if (scriptId === undefined) throw new Error('offline');
    });

    await hook({
      options: { scriptId: 'cart' },
      script: { locator: { url: 'https://cdn.example/cart/cart.container.js.bundle' } },
      loadScript,
    });

    expect(loadScript).toHaveBeenCalledTimes(2);
    expect(loadScript.mock.calls[1]?.[1]).toMatchObject({
      url: `file:///${CONTAINER_FILE}`,
      absolute: false,
    });
  });

  it('loads chunks locally once the remote is embedded', async () => {
    const hook = setUp();
    await hook({
      options: { scriptId: 'cart' },
      script: { locator: { url: 'https://cdn.example/cart/cart.container.js.bundle' } },
      loadScript: async (scriptId?: string) => {
        if (scriptId === undefined) throw new Error('offline');
      },
    });
    const loadScript = rs.fn(async (_scriptId?: string, _locator?: object) => undefined);

    await hook({
      options: { scriptId: 'src_Card', caller: 'cart' },
      script: { locator: { url: 'https://cdn.example/cart/src_Card.chunk.bundle?x=1' } },
      loadScript,
    });

    expect(loadScript).toHaveBeenCalledTimes(1);
    expect(loadScript.mock.calls[0]?.[1]).toMatchObject({ url: `file:///${CHUNK_FILE}` });
  });
});
