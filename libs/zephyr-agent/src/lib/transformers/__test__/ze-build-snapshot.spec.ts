import { describe, expect, it } from '@rstest/core';
import type { ZephyrEngine } from '../../../zephyr-engine';
import { zeBuildAssets } from '../ze-build-assets';
import { createSnapshot } from '../ze-build-snapshot';

function engine(baseHref: string): ZephyrEngine {
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
    env: { isCI: false, target: 'web', ssr: false },
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
});
