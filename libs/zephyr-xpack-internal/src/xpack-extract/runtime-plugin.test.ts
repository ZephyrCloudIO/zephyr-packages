import { afterEach, describe, expect, it, rs } from '@rstest/core';
import type { ZephyrDependency, ZephyrManifest } from 'zephyr-edge-contract';
import type { BeforeRequestHookArgs } from '../types/module-federation.types';
import { createZephyrRuntimePlugin } from './runtime-plugin';

const originalFetch = globalThis.fetch;
const originalSessionStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  'sessionStorage'
);
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
let manifestSequence = 0;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalSessionStorage) {
    Object.defineProperty(globalThis, 'sessionStorage', originalSessionStorage);
  } else {
    Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
  if (originalDocument) {
    Object.defineProperty(globalThis, 'document', originalDocument);
  } else {
    Reflect.deleteProperty(globalThis, 'document');
  }
  (globalThis as any).__ZEPHYR_MANIFEST_CACHE__?.clear();
});

function dependency(overrides: Partial<ZephyrDependency> = {}): ZephyrDependency {
  return {
    application_uid: 'acme.planetscale',
    remote_entry_url: 'https://cdn.example.test/remoteEntry.js',
    default_url: 'https://cdn.example.test',
    name: 'planetscale',
    library_type: 'var',
    ...overrides,
  };
}

function manifest(remote: ZephyrDependency): ZephyrManifest {
  return {
    dependencies: { planetscale: remote },
    zeVars: {},
    version: '1',
    timestamp: '2026-07-11T00:00:00.000Z',
  };
}

function request(entry: string, type?: string): BeforeRequestHookArgs {
  return {
    id: 'planetscale/App',
    options: {
      name: 'tap-host',
      remotes: [{ name: 'planetscale', entry, type }],
      shared: {},
    },
    origin: {},
  };
}

async function resolveRemote(
  remote: ZephyrDependency,
  args: BeforeRequestHookArgs
): Promise<BeforeRequestHookArgs> {
  globalThis.fetch = rs.fn(async () => ({
    ok: true,
    json: async () => manifest(remote),
  })) as unknown as typeof fetch;

  const plugin = createZephyrRuntimePlugin({
    manifestUrl: `https://host.example.test/${++manifestSequence}.json`,
  });

  return await plugin.beforeRequest!(args);
}

function mockManifestFetch() {
  globalThis.fetch = rs.fn(async () => ({
    ok: true,
    json: async () => manifest(dependency()),
  })) as unknown as typeof fetch;
}

function injectManifestMeta(content: string) {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      currentScript: null,
      querySelector: () => ({ getAttribute: () => content }),
    },
  });
}

describe('createZephyrRuntimePlugin manifest URL resolution', () => {
  it('prefers an explicit URL over injected metadata and preserves it opaquely', () => {
    mockManifestFetch();
    injectManifestMeta('/zephyr-manifest.meta.json');
    const explicitUrl = '/manifests/pinned.json?target=a%2Fb#revision';

    createZephyrRuntimePlugin({ manifestUrl: explicitUrl });

    expect(globalThis.fetch).toHaveBeenCalledWith(explicitUrl);
  });

  it('uses the injected metadata URL when no explicit URL is provided', () => {
    mockManifestFetch();
    const metaUrl =
      '/zephyr-manifest.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json?source=edge#pin';
    injectManifestMeta(metaUrl);

    createZephyrRuntimePlugin();

    expect(globalThis.fetch).toHaveBeenCalledWith(metaUrl);
  });

  it('falls back to the stable alias without a DOM', () => {
    mockManifestFetch();
    Reflect.deleteProperty(globalThis, 'document');

    createZephyrRuntimePlugin();

    expect(globalThis.fetch).toHaveBeenCalledWith('/zephyr-manifest.json');
  });

  it('keys the global cache by the complete selected URL', () => {
    mockManifestFetch();
    const first = '/manifest.json?revision=one#pin';
    const second = '/manifest.json?revision=two#pin';

    createZephyrRuntimePlugin({ manifestUrl: first });
    createZephyrRuntimePlugin({ manifestUrl: second });
    createZephyrRuntimePlugin({ manifestUrl: first });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(globalThis.fetch).toHaveBeenCalledWith(first);
    expect(globalThis.fetch).toHaveBeenCalledWith(second);
  });
});

describe('createZephyrRuntimePlugin remote resolution', () => {
  it('preserves the MF manifest URL and lets its snapshot define the entry type', async () => {
    const args = request('https://old.example.test/remoteEntry.js', 'var');
    const result = await resolveRemote(
      dependency({
        manifest_url: 'https://cdn.example.test/releases/42/mf-manifest.json',
        remote_entry_url: 'https://cdn.example.test/releases/42/remoteEntry.mjs',
        library_type: 'module',
      }),
      args
    );

    expect(result.options.remotes[0]).toEqual({
      name: 'planetscale',
      entry: 'https://cdn.example.test/releases/42/mf-manifest.json',
    });
  });

  it('marks a direct ESM remote as a module', async () => {
    const args = request('https://old.example.test/remoteEntry.js', 'var');
    const result = await resolveRemote(
      dependency({
        remote_entry_url: 'planetscale@https://cdn.example.test/remoteEntry.mjs',
        library_type: 'module',
      }),
      args
    );

    expect(result.options.remotes[0]).toEqual({
      name: 'planetscale',
      entry: 'https://cdn.example.test/remoteEntry.mjs',
      type: 'module',
    });
  });

  it('keeps a development session override ahead of the published manifest', async () => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: () => 'planetscale@https://dev.example.test/remoteEntry.mjs?tag=local',
      },
    });
    const args = request('https://old.example.test/remoteEntry.js', 'var');
    const result = await resolveRemote(
      dependency({
        manifest_url: 'https://cdn.example.test/mf-manifest.json',
        library_type: 'module',
      }),
      args
    );

    expect(result.options.remotes[0]).toEqual({
      name: 'planetscale',
      entry: 'https://dev.example.test/remoteEntry.mjs?tag=local',
      type: 'module',
    });
  });
});
