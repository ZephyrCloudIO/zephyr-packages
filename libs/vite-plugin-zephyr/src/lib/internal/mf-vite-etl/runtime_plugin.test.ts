import { afterEach, describe, expect, it, rs } from '@rstest/core';
import createZephyrRuntimePlugin from './runtime_plugin.mjs';

const originalFetch = globalThis.fetch;
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const originalSessionStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  'sessionStorage'
);

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreProperty('document', originalDocument);
  restoreProperty('sessionStorage', originalSessionStorage);
  (globalThis as any).__ZEPHYR_MANIFEST_CACHE__?.clear();
});

function restoreProperty(name: string, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    Reflect.deleteProperty(globalThis, name);
  }
}

function dependency(overrides: Record<string, string | undefined> = {}) {
  return {
    application_uid: 'acme.planetscale',
    remote_entry_url: 'https://cdn.example.test/remoteEntry.js',
    default_url: 'https://cdn.example.test',
    name: 'planetscale',
    library_type: 'var',
    ...overrides,
  };
}

function manifest(remote = dependency()) {
  return {
    dependencies: { planetscale: remote },
    zeVars: {},
    version: '1',
    timestamp: '2026-08-10T00:00:00.000Z',
  };
}

function mockManifestFetch(remote = dependency()) {
  globalThis.fetch = rs.fn(async () => ({
    ok: true,
    json: async () => manifest(remote),
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

function request(type = 'var') {
  return {
    id: 'planetscale/App',
    options: {
      remotes: [
        {
          name: 'planetscale',
          entry: 'https://old.example.test/remoteEntry.js',
          type,
        },
      ],
    },
  };
}

describe('Vite runtime manifest URL resolution', () => {
  it('uses explicit, metadata, then stable precedence without rewriting URLs', () => {
    mockManifestFetch();
    const metaUrl = '/meta.json?target=edge#pin';
    const explicitUrl = '/explicit.json?target=a%2Fb#revision';
    injectManifestMeta(metaUrl);

    createZephyrRuntimePlugin({ manifestUrl: explicitUrl });
    createZephyrRuntimePlugin();
    Reflect.deleteProperty(globalThis, 'document');
    createZephyrRuntimePlugin();

    expect(globalThis.fetch).toHaveBeenCalledWith(explicitUrl);
    expect(globalThis.fetch).toHaveBeenCalledWith(metaUrl);
    expect(globalThis.fetch).toHaveBeenCalledWith('/zephyr-manifest.json');
  });

  it('keys the cache by the complete selected URL', () => {
    mockManifestFetch();
    const first = '/manifest.json?revision=one#pin';
    const second = '/manifest.json?revision=two#pin';

    createZephyrRuntimePlugin({ manifestUrl: first });
    createZephyrRuntimePlugin({ manifestUrl: second });
    createZephyrRuntimePlugin({ manifestUrl: first });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('Vite runtime remote resolution', () => {
  it('prefers an MF manifest and clears a stale direct-entry type', async () => {
    mockManifestFetch(
      dependency({
        manifest_url: 'https://cdn.example.test/releases/42/mf-manifest.json?pin=1',
        remote_entry_url: 'https://cdn.example.test/releases/42/remoteEntry.mjs',
        library_type: 'module',
      })
    );
    const args = request();
    const plugin = createZephyrRuntimePlugin({ manifestUrl: '/host-mf.json' });

    await plugin.beforeRequest(args);

    expect(args.options.remotes[0]).toEqual({
      name: 'planetscale',
      entry: 'https://cdn.example.test/releases/42/mf-manifest.json?pin=1',
    });
  });

  it('marks a direct ESM remote as a module', async () => {
    mockManifestFetch(
      dependency({
        remote_entry_url: 'planetscale@https://cdn.example.test/remoteEntry.mjs',
        library_type: 'module',
      })
    );
    const args = request();
    const plugin = createZephyrRuntimePlugin({ manifestUrl: '/host-esm.json' });

    await plugin.beforeRequest(args);

    expect(args.options.remotes[0]).toEqual({
      name: 'planetscale',
      entry: 'https://cdn.example.test/remoteEntry.mjs',
      type: 'module',
    });
  });

  it('keeps a session override ahead of the published MF manifest', async () => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: () => 'planetscale@https://dev.example.test/remoteEntry.mjs?tag=local',
      },
    });
    mockManifestFetch(
      dependency({
        manifest_url: 'https://cdn.example.test/mf-manifest.json',
        library_type: 'module',
      })
    );
    const args = request();
    const plugin = createZephyrRuntimePlugin({ manifestUrl: '/host-override.json' });

    await plugin.beforeRequest(args);

    expect(args.options.remotes[0]).toEqual({
      name: 'planetscale',
      entry: 'https://dev.example.test/remoteEntry.mjs?tag=local',
      type: 'module',
    });
  });
});
