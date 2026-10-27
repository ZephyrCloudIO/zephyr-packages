import type { ModuleFederationRuntimePlugin } from '@module-federation/runtime';
import { afterAll, beforeAll, beforeEach, describe, expect, it, rs } from '@rstest/core';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ZephyrNativeEnvStorage } from 'zephyr-edge-contract';

import { createNativeEnvRuntimePlugin } from './env-runtime-plugin';

type AfterResolveArgs = Parameters<
  NonNullable<ModuleFederationRuntimePlugin['afterResolve']>
>[0];

type BeforeRequestArgs = Parameters<
  NonNullable<ModuleFederationRuntimePlugin['beforeRequest']>
>[0];

type TestRemote = { name: string; alias?: string; entry: string; type?: string };

type Route = { status?: number; body?: unknown; hang?: boolean };

const routes = new Map<string, Route>();
const hits = new Map<string, number>();
const stored = new Map<string, string>();
let server: http.Server;
let origin = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const requestPath = req.url ?? '';
    hits.set(requestPath, (hits.get(requestPath) ?? 0) + 1);
    const route = routes.get(requestPath);
    if (route?.hang) return;
    res.statusCode = route ? (route.status ?? 200) : 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(route?.body === undefined ? '' : JSON.stringify(route.body));
  });
  const listening = Promise.withResolvers<void>();
  server.listen(0, '127.0.0.1', listening.resolve);
  await listening.promise;
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  const closed = Promise.withResolvers<void>();
  server.close(() => closed.resolve());
  await closed.promise;
});

beforeEach(() => {
  globalThis.__ZEPHYR__ = undefined;
  globalThis.__FEDERATION__ = undefined as never;
  routes.clear();
  hits.clear();
  stored.clear();
  rs.spyOn(console, 'warn').mockImplementation(() => undefined);
});

const HOST_UID = 'host.p.o';

function env(uid: string): Readonly<Record<string, string>> | undefined {
  return globalThis.__ZEPHYR__?.runtime.env?.[uid];
}

function installEnvStorage(
  envStorage: ZephyrNativeEnvStorage = {
    getItem: async (key) => stored.get(key),
    setItem: async (key, value) => {
      stored.set(key, value);
    },
  }
): void {
  globalThis.__ZEPHYR__ = {
    version: 1,
    runtime: { nativeCache: { refs: { envStorage } } },
  };
}

async function resolveRemote(name: string, entry: string, alias?: string): Promise<void> {
  const plugin = createNativeEnvRuntimePlugin({ host: HOST_UID });
  const args = { remote: { name, alias, entry } } as unknown as AfterResolveArgs;
  const result = await plugin.afterResolve?.(args);
  expect(result).toBe(args);
}

async function serveHost(
  dependencies: Record<string, unknown> = {},
  zeVars: unknown = {}
): Promise<void> {
  routes.set('/host/zephyr-manifest.json', { body: { dependencies, zeVars } });
  await resolveRemote('host', `${origin}/host/mf-manifest.json`);
}

/** Runs `beforeRequest` as the federation instance `instanceName` requesting `id`. */
async function requestRemote(
  instanceName: string,
  remotes: TestRemote[],
  id: string
): Promise<void> {
  const plugin = createNativeEnvRuntimePlugin({ host: HOST_UID });
  const args = {
    id,
    options: { name: instanceName, remotes },
  } as unknown as BeforeRequestArgs;
  const result = await plugin.beforeRequest?.(args);
  expect(result).toBe(args);
}

describe('zephyr env runtime plugin', () => {
  it('stores public string values for the Host UID', async () => {
    await serveHost({}, { ZE_PUBLIC_DEMO: 'staging', ZE_PUBLIC_EMPTY: '' });

    expect(env(HOST_UID)).toEqual({ ZE_PUBLIC_DEMO: 'staging', ZE_PUBLIC_EMPTY: '' });
  });

  it('drops non-string values and non-public keys', async () => {
    await serveHost(
      {},
      {
        ZE_PUBLIC_DEMO: 'ok',
        ZE_PUBLIC_NUM: 1,
        PRIVATE: 'x',
        ze_public_lower: 'y',
      }
    );

    expect(env(HOST_UID)).toEqual({ ZE_PUBLIC_DEMO: 'ok' });
  });

  it('times out a hanging manifest and resolves without values', async () => {
    routes.set('/host/zephyr-manifest.json', { hang: true });

    await resolveRemote('host', `${origin}/host/mf-manifest.json`);

    expect(env(HOST_UID)).toBeUndefined();
  }, 10_000);

  it('stores nothing for a 404', async () => {
    await resolveRemote('host', `${origin}/missing/mf-manifest.json`);

    expect(env(HOST_UID)).toBeUndefined();
    expect(hits.get('/missing/zephyr-manifest.json')).toBe(1);
  });

  it('persists each loaded manifest in the native-cache store', async () => {
    installEnvStorage();
    await serveHost({}, { ZE_PUBLIC_DEMO: 'staging' });

    expect(
      JSON.parse(stored.get(`${origin}/host/zephyr-manifest.json`) ?? '{}').zeVars
    ).toEqual({ ZE_PUBLIC_DEMO: 'staging' });
  });

  it('runs session-only without the native-cache store', async () => {
    await serveHost({}, { ZE_PUBLIC_DEMO: 'staging' });

    expect(globalThis.__ZEPHYR__?.runtime.nativeCache).toBeUndefined();
    expect(env(HOST_UID)).toEqual({ ZE_PUBLIC_DEMO: 'staging' });
  });

  it('applies the last persisted values when manifests cannot be loaded', async () => {
    installEnvStorage();
    stored.set(
      `${origin}/mini/zephyr-manifest.json`,
      JSON.stringify({ zeVars: { ZE_PUBLIC_DEMO: 'cached' } })
    );
    await serveHost({ mini: { application_uid: 'mini.p.o' } });
    await resolveRemote('mini', `${origin}/mini/mf-manifest.json`);

    expect(env('mini.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'cached' });
  });

  it('keeps build-time values without readable persisted values for the URL', async () => {
    installEnvStorage();
    stored.set(`${origin}/mini/zephyr-manifest.json`, '{not json');
    await serveHost({ mini: { application_uid: 'mini.p.o' } });
    await resolveRemote('mini', `${origin}/mini/mf-manifest.json`);

    expect(env('mini.p.o')).toBeUndefined();
  });

  it('loads normally when the native-cache store fails', async () => {
    installEnvStorage({
      getItem: async () => {
        throw new Error('read failed');
      },
      setItem: async () => {
        throw new Error('write failed');
      },
    });
    await serveHost(
      { mini: { application_uid: 'mini.p.o' } },
      { ZE_PUBLIC_DEMO: 'staging' }
    );

    expect(env(HOST_UID)).toEqual({ ZE_PUBLIC_DEMO: 'staging' });

    await resolveRemote('mini', `${origin}/mini/mf-manifest.json`);
    expect(env('mini.p.o')).toBeUndefined();
  });

  it('loads the manifest next to each resolved remote entry', async () => {
    await serveHost({
      mini: { application_uid: 'mini.p.o' },
      sub: { application_uid: 'sub.p.o' },
    });
    routes.set('/mini/zephyr-manifest.json', {
      body: { zeVars: { ZE_PUBLIC_DEMO: 'mini' } },
    });
    routes.set('/sub/ios/zephyr-manifest.json', {
      body: { zeVars: { ZE_PUBLIC_DEMO: 'sub' } },
    });

    await resolveRemote('mini', `${origin}/mini/mf-manifest.json`);
    await resolveRemote('sub', `sub@${origin}/sub/ios/R.container.js.bundle?v=1#x`);

    expect(env('mini.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'mini' });
    expect(env('sub.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'sub' });
  });

  it('issues no request for a remote that neither the seed nor a manifest lists', async () => {
    await serveHost();
    hits.clear();
    await resolveRemote('unknown', `${origin}/unknown/mf-manifest.json`);

    expect(hits.size).toBe(0);
  });

  it('shares one request between concurrent resolutions of one URL', async () => {
    await serveHost({ mini: { application_uid: 'mini.p.o' } });
    routes.set('/mini/zephyr-manifest.json', {
      body: { zeVars: { ZE_PUBLIC_DEMO: 'mini' } },
    });
    const entry = `${origin}/mini/mf-manifest.json`;

    await Promise.all([resolveRemote('mini', entry), resolveRemote('mini', entry)]);

    expect(hits.get('/mini/zephyr-manifest.json')).toBe(1);
    expect(env('mini.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'mini' });
  });

  it('warms remote manifests listed with a remote_entry_url', async () => {
    const entry = `${origin}/mini/mf-manifest.json`;
    routes.set('/mini/zephyr-manifest.json', {
      body: { zeVars: { ZE_PUBLIC_DEMO: 'mini' } },
    });
    await serveHost({ mini: { application_uid: 'mini.p.o', remote_entry_url: entry } });

    await resolveRemote('mini', entry);

    expect(hits.get('/mini/zephyr-manifest.json')).toBe(1);
    expect(env('mini.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'mini' });
  });

  it('retries a failed manifest on the next resolution', async () => {
    await serveHost({ mini: { application_uid: 'mini.p.o' } });
    const entry = `${origin}/mini/mf-manifest.json`;

    await resolveRemote('mini', entry);
    expect(env('mini.p.o')).toBeUndefined();

    routes.set('/mini/zephyr-manifest.json', {
      body: { zeVars: { ZE_PUBLIC_DEMO: 'mini' } },
    });
    await resolveRemote('mini', entry);

    expect(hits.get('/mini/zephyr-manifest.json')).toBe(2);
    expect(env('mini.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'mini' });
  });

  it('retries the network after applying persisted values for a failed manifest', async () => {
    installEnvStorage();
    stored.set(
      `${origin}/mini/zephyr-manifest.json`,
      JSON.stringify({ zeVars: { ZE_PUBLIC_DEMO: 'cached' } })
    );
    await serveHost({ mini: { application_uid: 'mini.p.o' } });
    const entry = `${origin}/mini/mf-manifest.json`;

    await resolveRemote('mini', entry);
    expect(env('mini.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'cached' });

    routes.set('/mini/zephyr-manifest.json', {
      body: { zeVars: { ZE_PUBLIC_DEMO: 'fresh' } },
    });
    await resolveRemote('mini', entry);
    expect(hits.get('/mini/zephyr-manifest.json')).toBe(2);
    expect(env('mini.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'fresh' });

    await resolveRemote('mini', entry);
    expect(hits.get('/mini/zephyr-manifest.json')).toBe(2);
  });

  it('keeps a pending persisted fallback from overwriting a newer network load', async () => {
    const readStarted = Promise.withResolvers<void>();
    const persistedRead = Promise.withResolvers<string | undefined>();
    installEnvStorage({
      getItem: async () => {
        readStarted.resolve();
        return persistedRead.promise;
      },
      setItem: async (key, value) => {
        stored.set(key, value);
      },
    });
    await serveHost({ mini: { application_uid: 'mini.p.o' } });
    const entry = `${origin}/mini/mf-manifest.json`;
    const manifestUrl = `${origin}/mini/zephyr-manifest.json`;
    const fetchSpy = rs.spyOn(globalThis, 'fetch');
    // `afterResolve` reaches `fetch` synchronously, so call counts need no waiting.
    const manifestFetches = () =>
      fetchSpy.mock.calls.filter(([url]) => url === manifestUrl).length;

    try {
      const first = resolveRemote('mini', entry);
      await readStarted.promise;
      routes.set('/mini/zephyr-manifest.json', {
        body: { zeVars: { ZE_PUBLIC_DEMO: 'fresh' } },
      });
      const second = resolveRemote('mini', entry);
      expect(manifestFetches()).toBe(1);

      persistedRead.resolve(JSON.stringify({ zeVars: { ZE_PUBLIC_DEMO: 'stale' } }));
      await Promise.all([first, second]);
      expect(env('mini.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'stale' });

      await resolveRemote('mini', entry);
      expect(manifestFetches()).toBe(2);
      expect(env('mini.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'fresh' });

      await resolveRemote('mini', entry);
      expect(manifestFetches()).toBe(2);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('clears values loaded from another root when a remote switches roots', async () => {
    await serveHost({ mini: { application_uid: 'mini.p.o' } });
    routes.set('/a/zephyr-manifest.json', { body: { zeVars: { ZE_PUBLIC_DEMO: 'a' } } });

    await resolveRemote('mini', `${origin}/a/mf-manifest.json`);
    expect(env('mini.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'a' });

    await resolveRemote('mini', `${origin}/b/mf-manifest.json`);

    expect(env('mini.p.o')).toBeUndefined();
  });

  it('points a requested remote at the entry its container environment lists', async () => {
    await serveHost({
      remote_blue: {
        application_uid: 'blue.p.o',
        remote_entry_url: `${origin}/blue-tag/remote_blue.bundle`,
        library_type: 'var',
      },
      green: {
        application_uid: 'green.p.o',
        remote_entry_url: `remote_green@${origin}/green-tag/remote_green.bundle`,
        manifest_url: `${origin}/green-tag/mf-manifest.json`,
        library_type: 'var',
      },
    });
    routes.set('/blue-tag/zephyr-manifest.json', {
      body: { zeVars: { ZE_PUBLIC_DEMO: 'blue-tag' } },
    });
    const blue: TestRemote = {
      alias: 'remote_blue',
      name: 'remote_blue',
      entry: `${origin}/blue-demo/mf-manifest.json`,
    };
    const green: TestRemote = {
      alias: 'green',
      name: 'remote_green',
      entry: `${origin}/green-demo/mf-manifest.json`,
      type: 'var',
    };

    await requestRemote('host', [blue, green], 'remote_blue/App');

    expect(blue).toEqual({
      alias: 'remote_blue',
      name: 'remote_blue',
      entry: `${origin}/blue-tag/remote_blue.bundle`,
      type: 'var',
    });
    expect(green.entry).toBe(`${origin}/green-demo/mf-manifest.json`);

    await requestRemote('host', [blue, green], 'green/App');

    expect(green).toEqual({
      alias: 'green',
      name: 'remote_green',
      entry: `${origin}/green-tag/mf-manifest.json`,
    });

    await resolveRemote('remote_blue', blue.entry, blue.alias);

    expect(env('blue.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'blue-tag' });
  });

  it('keeps build-time entries for containers without a loaded environment', async () => {
    await serveHost({
      mini: {
        application_uid: 'mini.p.o',
        remote_entry_url: `${origin}/mini-tag/mini.bundle`,
      },
    });
    const buildEntry = `${origin}/mini/mf-manifest.json`;
    const mini: TestRemote = { name: 'mini', entry: buildEntry };

    await requestRemote('shell', [mini], 'mini/App');
    expect(mini.entry).toBe(buildEntry);

    // The Host switches to a root whose manifest is missing: its old environment no longer applies.
    await resolveRemote('host', `${origin}/host-b/mf-manifest.json`);
    await requestRemote('host', [mini], 'mini/App');

    expect(mini.entry).toBe(buildEntry);
  });

  it('resolves nested remotes from a remote manifest', async () => {
    await serveHost({ a: { application_uid: 'a.p.o' } });
    routes.set('/a/zephyr-manifest.json', {
      body: { zeVars: {}, dependencies: { b: { application_uid: 'b.p.o' } } },
    });
    routes.set('/b/zephyr-manifest.json', {
      body: { zeVars: { ZE_PUBLIC_DEMO: 'b' } },
    });

    await resolveRemote('a', `${origin}/a/mf-manifest.json`);
    await resolveRemote('b', `${origin}/b/mf-manifest.json`);

    expect(env('b.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'b' });
  });

  it('skips a remote name mapped to two applications', async () => {
    await serveHost({
      a: { application_uid: 'a.p.o' },
      mini: { application_uid: 'mini.p.o' },
    });
    routes.set('/a/zephyr-manifest.json', {
      body: { zeVars: {}, dependencies: { mini: { application_uid: 'other.p.o' } } },
    });
    routes.set('/mini/zephyr-manifest.json', {
      body: { zeVars: { ZE_PUBLIC_DEMO: 'mini' } },
    });

    await resolveRemote('a', `${origin}/a/mf-manifest.json`);
    await resolveRemote('mini', `${origin}/mini/mf-manifest.json`);

    expect(hits.get('/mini/zephyr-manifest.json')).toBeUndefined();
    expect(env('mini.p.o')).toBeUndefined();
    expect(env('other.p.o')).toBeUndefined();
  });

  it('maps a remote by consumer alias before its container name', async () => {
    await serveHost({
      mini: { application_uid: 'admin.p.o' },
      shop: { application_uid: 'shop.p.o' },
    });
    routes.set('/admin/zephyr-manifest.json', {
      body: { zeVars: { ZE_PUBLIC_DEMO: 'admin' } },
    });
    routes.set('/shop/zephyr-manifest.json', {
      body: { zeVars: { ZE_PUBLIC_DEMO: 'shop' } },
    });

    await resolveRemote('admin', `${origin}/admin/mf-manifest.json`, 'mini');
    await resolveRemote('mini', `${origin}/shop/mf-manifest.json`, 'shop');

    expect(env('admin.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'admin' });
    expect(env('shop.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'shop' });
  });

  it('skips an ambiguous alias without falling back to the container name', async () => {
    await serveHost({
      a: { application_uid: 'a.p.o' },
      mini: { application_uid: 'mini.p.o' },
      shop: { application_uid: 'shop.p.o' },
    });
    routes.set('/a/zephyr-manifest.json', {
      body: { zeVars: {}, dependencies: { shop: { application_uid: 'other.p.o' } } },
    });
    routes.set('/shop/zephyr-manifest.json', {
      body: { zeVars: { ZE_PUBLIC_DEMO: 'shop' } },
    });

    await resolveRemote('a', `${origin}/a/mf-manifest.json`);
    await resolveRemote('mini', `${origin}/shop/mf-manifest.json`, 'shop');

    expect(hits.get('/shop/zephyr-manifest.json')).toBeUndefined();
    expect(env('mini.p.o')).toBeUndefined();
    expect(env('shop.p.o')).toBeUndefined();
  });

  it('registers one global plugin copy for nested federation instances', () => {
    const federation = {
      __GLOBAL_PLUGIN__: [],
    } as unknown as typeof globalThis.__FEDERATION__;
    globalThis.__FEDERATION__ = federation;
    const plugin = createNativeEnvRuntimePlugin({ host: HOST_UID });
    const args = {} as Parameters<NonNullable<typeof plugin.beforeInit>>[0];
    plugin.beforeInit?.(args);
    createNativeEnvRuntimePlugin({ host: HOST_UID }).beforeInit?.(args);

    expect(federation.__GLOBAL_PLUGIN__?.map((item) => item.name)).toEqual([
      'zephyr-env-plugin',
    ]);
  });

  it('applies the Host seed values, then nested remote values from the Host manifest', async () => {
    routes.set('/host/zephyr-manifest.json', {
      body: {
        zeVars: { ZE_PUBLIC_DEMO: 'host-env' },
        dependencies: { mini: { application_uid: 'mini.p.o' } },
      },
    });
    routes.set('/mini/zephyr-manifest.json', {
      body: { zeVars: { ZE_PUBLIC_DEMO: 'mini-env' } },
    });

    await resolveRemote('host', `${origin}/host/mf-manifest.json`);
    await resolveRemote('mini', `${origin}/mini/mf-manifest.json`);

    expect(env('host.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'host-env' });
    expect(env('mini.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'mini-env' });
  });
});
