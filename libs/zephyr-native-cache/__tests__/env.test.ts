import type { ModuleFederationRuntimePlugin } from '@module-federation/runtime';
import { afterAll, beforeAll, beforeEach, describe, expect, it, rs } from '@rstest/core';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

const native = rs.hoisted(() => ({
  files: new Map<string, string>(),
  getDocumentDirectory: rs.fn(async () => '/docs'),
  sha256String: rs.fn(
    async (value: string) => `h${value.length}${value.replace(/\W/g, '')}`
  ),
  fileExists: rs.fn(async (file: string) => native.files.has(file)),
  readFile: rs.fn(async (file: string) => native.files.get(file)!),
  writeFile: rs.fn(async (file: string, content: string) => {
    native.files.set(file, content);
  }),
}));

rs.mock('../src/NativeMFECache', () => ({ default: native }));

import createZephyrNativeCachePlugin from '../src/runtime-plugin';

type AfterResolveArgs = Parameters<
  NonNullable<ModuleFederationRuntimePlugin['afterResolve']>
>[0];

type Route = { status?: number; body?: unknown; hang?: boolean };

const routes = new Map<string, Route>();
const hits = new Map<string, number>();
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
  routes.clear();
  hits.clear();
  native.files.clear();
  native.fileExists.mockImplementation(async (file) => native.files.has(file));
  native.readFile.mockImplementation(async (file) => native.files.get(file)!);
  native.writeFile.mockImplementation(async (file, content) => {
    native.files.set(file, content);
  });
  rs.spyOn(console, 'warn').mockImplementation(() => undefined);
});

const HOST_UID = 'host.p.o';

function env(uid: string): Readonly<Record<string, string>> | undefined {
  return globalThis.__ZEPHYR__?.runtime.env?.[uid];
}

async function resolveRemote(name: string, entry: string, alias?: string): Promise<void> {
  const plugin = createZephyrNativeCachePlugin();
  const args = { remote: { name, alias, entry } } as unknown as AfterResolveArgs;
  const result = await plugin.afterResolve?.(args);
  expect(result).toBe(args);
}

async function serveHost(
  dependencies: Record<string, unknown> = {},
  zeVars: unknown = {}
): Promise<void> {
  globalThis.__ZEPHYR__ = {
    version: 1,
    runtime: { remoteApplicationUids: { host: HOST_UID } },
  };
  routes.set('/host/zephyr-manifest.json', { body: { dependencies, zeVars } });
  await resolveRemote('host', `${origin}/host/mf-manifest.json`);
}

function persistedPath(url: string): string {
  return `/docs/zephyr-env-h${url.length}${url.replace(/\W/g, '')}.json`;
}

describe('zephyr-native-cache environment loading', () => {
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
    globalThis.__ZEPHYR__ = {
      version: 1,
      runtime: { remoteApplicationUids: { host: HOST_UID } },
    };
    routes.set('/host/zephyr-manifest.json', { hang: true });

    await resolveRemote('host', `${origin}/host/mf-manifest.json`);

    expect(env(HOST_UID)).toBeUndefined();
  }, 10_000);

  it('stores nothing for a 404', async () => {
    globalThis.__ZEPHYR__ = {
      version: 1,
      runtime: { remoteApplicationUids: { host: HOST_UID } },
    };
    await resolveRemote('host', `${origin}/missing/mf-manifest.json`);

    expect(env(HOST_UID)).toBeUndefined();
    expect(hits.get('/missing/zephyr-manifest.json')).toBe(1);
  });

  it('applies the last persisted values when manifests cannot be loaded', async () => {
    const url = `${origin}/mini/zephyr-manifest.json`;
    native.files.set(
      persistedPath(url),
      JSON.stringify({ zeVars: { ZE_PUBLIC_DEMO: 'cached' } })
    );
    await serveHost({ mini: { application_uid: 'mini.p.o' } });
    await resolveRemote('mini', `${origin}/mini/mf-manifest.json`);

    expect(env('mini.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'cached' });
  });

  it('keeps build-time values without readable persisted values for the URL', async () => {
    const url = `${origin}/mini/zephyr-manifest.json`;
    native.files.set(persistedPath(url), '{not json');
    await serveHost({ mini: { application_uid: 'mini.p.o' } });
    await resolveRemote('mini', `${origin}/mini/mf-manifest.json`);

    expect(env('mini.p.o')).toBeUndefined();
  });

  it('loads normally when native file persistence fails', async () => {
    native.writeFile.mockRejectedValue(new Error('write failed'));
    await serveHost(
      { mini: { application_uid: 'mini.p.o' } },
      { ZE_PUBLIC_DEMO: 'staging' }
    );

    expect(env(HOST_UID)).toEqual({ ZE_PUBLIC_DEMO: 'staging' });

    const url = `${origin}/mini/zephyr-manifest.json`;
    native.files.set(persistedPath(url), 'unreadable');
    native.readFile.mockRejectedValue(new Error('read failed'));
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
    const url = `${origin}/mini/zephyr-manifest.json`;
    native.files.set(
      persistedPath(url),
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

  it('clears values loaded from another root when a remote switches roots', async () => {
    await serveHost({ mini: { application_uid: 'mini.p.o' } });
    routes.set('/a/zephyr-manifest.json', { body: { zeVars: { ZE_PUBLIC_DEMO: 'a' } } });

    await resolveRemote('mini', `${origin}/a/mf-manifest.json`);
    expect(env('mini.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'a' });

    await resolveRemote('mini', `${origin}/b/mf-manifest.json`);

    expect(env('mini.p.o')).toBeUndefined();
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
    const plugin = createZephyrNativeCachePlugin();
    const args = {} as Parameters<NonNullable<typeof plugin.beforeInit>>[0];
    plugin.beforeInit?.(args);
    createZephyrNativeCachePlugin().beforeInit?.(args);

    expect(federation.__GLOBAL_PLUGIN__?.map((item) => item.name)).toEqual([
      'zephyr-native-cache-plugin',
    ]);
  });

  it('applies the Host seed values, then nested remote values from the Host manifest', async () => {
    routes.set('/host/zephyr-manifest.json', {
      body: {
        zeVars: { ZE_PUBLIC_DEMO: 'host-env' },
        dependencies: { mini: { application_uid: 'mini.p.o' } },
      },
    });
    globalThis.__ZEPHYR__ = {
      version: 1,
      runtime: { remoteApplicationUids: { host: HOST_UID } },
    };
    routes.set('/mini/zephyr-manifest.json', {
      body: { zeVars: { ZE_PUBLIC_DEMO: 'mini-env' } },
    });

    await resolveRemote('host', `${origin}/host/mf-manifest.json`);
    await resolveRemote('mini', `${origin}/mini/mf-manifest.json`);

    expect(env('host.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'host-env' });
    expect(env('mini.p.o')).toEqual({ ZE_PUBLIC_DEMO: 'mini-env' });
  });
});
