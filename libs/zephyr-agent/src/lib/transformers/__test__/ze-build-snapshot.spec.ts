import { describe, expect, it } from '@rstest/core';
import type { ZephyrEngine } from '../../../zephyr-engine';
import { zeBuildAssets } from '../ze-build-assets';
import { createSnapshot } from '../ze-build-snapshot';

function engine(baseHref: string, target: 'web' | 'tap-app' = 'web'): ZephyrEngine {
  return {
    build_id: Promise.resolve('build-1'),
    application_configuration: Promise.resolve({
      username: 'builder',
      email: 'builder@example.com',
      EDGE_URL: 'https://edge.example.com',
      ADDRESS_MODE: 'path',
    }),
    applicationProperties: {
      org: 'org',
      project: 'project',
      name: 'app',
      version: '1.0.0',
    },
    gitProperties: {
      git: { branch: 'main', commit: 'abc123', tags: [] },
    },
    buildProperties: { output: 'dist', baseHref },
    env: { isCI: false, target, ssr: false },
    builder: 'vite',
  } as unknown as ZephyrEngine;
}

async function ssrSnapshot(baseHref: string) {
  const asset = zeBuildAssets({ filepath: 'server/index.js', content: 'server' });
  return createSnapshot(engine(baseHref), {
    mfConfig: undefined,
    assets: { [asset.hash]: asset },
    snapshotType: 'ssr',
    entrypoint: 'server/index.js',
  });
}

describe('createSnapshot baseHref entrypoint handling', () => {
  it('retains every federation config in the snapshot metadata', async () => {
    const asset = zeBuildAssets({
      filepath: 'targets/desktop/remoteEntry.mjs',
      content: 'entry',
    });

    const snapshot = await createSnapshot(engine(''), {
      mfConfig: undefined,
      mfConfigs: [
        {
          name: 'desktop',
          filename: 'targets/desktop/remoteEntry.mjs',
          library: { type: 'module' },
        },
        {
          name: 'worker',
          filename: 'targets/worker/remoteEntry.mjs',
          library: { type: 'module' },
        },
      ],
      assets: { [asset.hash]: asset },
    });

    expect(snapshot.mfConfigs).toEqual([
      {
        name: 'desktop',
        filename: 'targets/desktop/remoteEntry.mjs',
        library: { type: 'module' },
      },
      {
        name: 'worker',
        filename: 'targets/worker/remoteEntry.mjs',
        library: { type: 'module' },
      },
    ]);
    expect(snapshot.target).toBe('web');
  });

  it('keeps the SSR entrypoint aligned with a non-root asset base', async () => {
    const snapshot = await ssrSnapshot('/application/');

    expect(snapshot.assets).toHaveProperty('application/server/index.js');
    expect(snapshot.entrypoint).toBe('application/server/index.js');
  });

  it('uses an absolute CDN base pathname for both assets and the SSR entrypoint', async () => {
    const snapshot = await ssrSnapshot('https://cdn.example.com/releases/current/');

    expect(snapshot.assets).toHaveProperty('releases/current/server/index.js');
    expect(snapshot.entrypoint).toBe('releases/current/server/index.js');
  });

  it('preserves locked tap-app paths and an SSR entrypoint even when a web base is configured', async () => {
    const entry = zeBuildAssets({
      filepath: 'targets/desktop/server/index.mjs',
      content: 'tap server',
    });
    const descriptor = zeBuildAssets({
      filepath: 'tap-package.json',
      content: '{"locked":true}',
    });

    const snapshot = await createSnapshot(engine('/web-routing-base/', 'tap-app'), {
      mfConfig: undefined,
      assets: { [entry.hash]: entry, [descriptor.hash]: descriptor },
      snapshotType: 'ssr',
      entrypoint: entry.path,
    });

    expect(snapshot.assets).toHaveProperty(entry.path);
    expect(snapshot.assets).toHaveProperty(descriptor.path);
    expect(snapshot.assets[entry.path]?.hash).toBe(entry.hash);
    expect(snapshot.assets[descriptor.path]?.hash).toBe(descriptor.hash);
    expect(snapshot.entrypoint).toBe(entry.path);
    expect(snapshot.target).toBe('tap-app');
  });
});
