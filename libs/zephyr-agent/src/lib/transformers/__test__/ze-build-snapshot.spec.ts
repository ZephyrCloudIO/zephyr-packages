import type { ZephyrEngine } from '../../../zephyr-engine';
import { zeBuildAssets } from '../ze-build-assets';
import { createSnapshot } from '../ze-build-snapshot';

function createMockZephyrEngine(): ZephyrEngine {
  return {
    build_id: Promise.resolve('1'),
    env: {
      isCI: false,
      target: 'web',
      env: 'development',
      ssr: false,
    },
    buildProperties: { output: './dist' },
    gitProperties: {
      app: { org: 'acme', project: 'dashboard' },
      git: {
        branch: 'main',
        commit: 'abc123',
      },
    },
    applicationProperties: {
      org: 'acme',
      project: 'dashboard',
      name: 'host',
      version: '1.0.0',
    },
    application_configuration: Promise.resolve({
      username: 'user',
      email: 'user@example.com',
      EDGE_URL: 'https://edge.example.com',
    }),
  } as unknown as ZephyrEngine;
}

describe('createSnapshot', () => {
  it('keeps contentEncoding metadata in snapshot assets', async () => {
    const zephyrEngine = createMockZephyrEngine();
    const encodedAsset = zeBuildAssets({
      filepath: 'assets/server.wasm',
      content: Buffer.from('A'.repeat(120_000)),
      contentEncoding: 'gzip',
    });

    const snapshot = await createSnapshot(zephyrEngine, {
      mfConfig: undefined,
      assets: {
        [encodedAsset.hash]: encodedAsset,
      },
      snapshotType: 'csr',
    });

    expect(snapshot.assets['assets/server.wasm']).toMatchObject({
      path: 'assets/server.wasm',
      hash: encodedAsset.hash,
      contentEncoding: 'gzip',
    });
  });
});
