import { afterEach, describe, expect, it, rs } from '@rstest/core';
import type { ZephyrDependency, ZephyrManifest } from 'zephyr-edge-contract';
import type { BeforeRequestHookArgs } from '../types/module-federation.types';
import { createZephyrRuntimePlugin } from './runtime-plugin';

const originalFetch = globalThis.fetch;
const originalSessionStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  'sessionStorage'
);
let manifestSequence = 0;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalSessionStorage) {
    Object.defineProperty(globalThis, 'sessionStorage', originalSessionStorage);
  } else {
    Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
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
