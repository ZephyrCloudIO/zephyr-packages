import type { ModuleFederationRuntimePlugin } from '@module-federation/runtime';
import { afterAll, beforeAll, beforeEach, describe, expect, it, rs } from '@rstest/core';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { preloadZephyrEnv } from '../src/index';
import createZephyrNativeEnvPlugin from '../src/runtime-plugin';

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
    const path = req.url ?? '';
    hits.set(path, (hits.get(path) ?? 0) + 1);
    const route = routes.get(path);
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
  rs.spyOn(console, 'warn').mockImplementation(() => undefined);
});

const HOST_UID = 'host.p.o';

function env(uid: string): Readonly<Record<string, string>> | undefined {
  return globalThis.__ZEPHYR__?.runtime.env?.[uid];
}

function serveHost(dependencies: Record<string, unknown> = {}, zeVars: unknown = {}) {
  routes.set('/host/zephyr-manifest.json', { body: { zeVars, dependencies } });
  return preloadZephyrEnv({
    applicationUid: HOST_UID,
    manifestUrl: `${origin}/host/zephyr-manifest.json`,
    timeoutMs: 1000,
  });
}

async function resolveRemote(name: string, entry: string): Promise<void> {
  const plugin = createZephyrNativeEnvPlugin();
  // MF passes far more fields; the plugin only reads `remote`.
  const args = { remote: { name, entry } } as unknown as AfterResolveArgs;
  const result = await plugin.afterResolve?.(args);
  expect(result).toBe(args);
}

describe('preloadZephyrEnv', () => {
  it('stores public string values for the host UID', async () => {
    await serveHost({}, { ZE_PUBLIC_DEMO: 'staging', ZE_PUBLIC_EMPTY: '' });
    expect(env(HOST_UID)).toEqual({ ZE_PUBLIC_DEMO: 'staging', ZE_PUBLIC_EMPTY: '' });
  });

  it('drops non-string values and non-public keys', async () => {
    await serveHost(
      {},
      { ZE_PUBLIC_DEMO: 'ok', ZE_PUBLIC_NUM: 1, PRIVATE: 'x', ze_public_lower: 'y' }
    );
    expect(env(HOST_UID)).toEqual({ ZE_PUBLIC_DEMO: 'ok' });
  });

  it('times out a hanging server and resolves without values', async () => {
    routes.set('/hang/zephyr-manifest.json', { hang: true });
    const started = Date.now();
    await preloadZephyrEnv({
      applicationUid: HOST_UID,
      manifestUrl: `${origin}/hang/zephyr-manifest.json`,
      timeoutMs: 300,
    });
    expect(Date.now() - started).toBeLessThan(800);
    expect(env(HOST_UID)).toBeUndefined();
  });

  it('stores nothing for a 404', async () => {
    await preloadZephyrEnv({
      applicationUid: HOST_UID,
      manifestUrl: `${origin}/missing/zephyr-manifest.json`,
    });
    expect(env(HOST_UID)).toBeUndefined();
    expect(hits.get('/missing/zephyr-manifest.json')).toBe(1);
  });

  it('resolves without a request when manifestUrl is omitted or not http(s)', async () => {
    await preloadZephyrEnv({ applicationUid: HOST_UID });
    await preloadZephyrEnv({ applicationUid: HOST_UID, manifestUrl: 'file:///x.json' });
    expect(hits.size).toBe(0);
    expect(env(HOST_UID)).toBeUndefined();
  });
});

describe('zephyr-native-env runtime plugin', () => {
  it('loads the manifest next to the remote entry', async () => {
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

  it('issues no request for a remote the host manifest does not list', async () => {
    await serveHost({ mini: { application_uid: 'mini.p.o' } });
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
    routes.set('/mini/zephyr-manifest.json', {
      body: { zeVars: { ZE_PUBLIC_DEMO: 'mini' } },
    });
    const entry = `${origin}/mini/mf-manifest.json`;
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

  it('clears values loaded from another root when the remote switches roots', async () => {
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
    routes.set('/b/zephyr-manifest.json', { body: { zeVars: { ZE_PUBLIC_DEMO: 'b' } } });

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

  it('registers one global plugin copy for nested federation instances', () => {
    const federation = {
      __GLOBAL_PLUGIN__: [],
    } as unknown as typeof globalThis.__FEDERATION__;
    globalThis.__FEDERATION__ = federation;
    const plugin = createZephyrNativeEnvPlugin();
    // beforeInit only reads its argument to return it.
    const args = {} as Parameters<NonNullable<typeof plugin.beforeInit>>[0];
    plugin.beforeInit?.(args);
    createZephyrNativeEnvPlugin().beforeInit?.(args);
    expect(federation.__GLOBAL_PLUGIN__.map((p) => p.name)).toEqual([
      'zephyr-native-env-plugin',
    ]);
  });
});
