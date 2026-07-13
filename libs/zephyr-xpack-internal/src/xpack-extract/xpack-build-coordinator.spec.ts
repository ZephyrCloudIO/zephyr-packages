import { describe, expect, it, rs } from '@rstest/core';
import type { ZeBuildAssetsMap, ZephyrEngine } from 'zephyr-agent';
import type { ZephyrBuildStats } from 'zephyr-edge-contract';
import { coordinateXPackCompilers } from './multi-compiler-coordinator';
import { XPackBuildCoordinator } from './xpack-build-coordinator';
import type { XPackParticipantDependencyPaths } from './xpack-build-coordinator';

function asset(path: string, hash: string): ZeBuildAssetsMap {
  return {
    [hash]: { path, hash, extname: '.js', size: 1, buffer: 'x' },
  };
}

function engine(): ZephyrEngine {
  return {
    application_uid: 'multi-compiler.test',
    buildProperties: { output: './dist' },
    env: { target: 'web' },
    start_new_build: rs.fn(async () => undefined),
    upload_assets: rs.fn(async () => undefined),
    build_finished: rs.fn(async () => undefined),
    build_failed: rs.fn(),
  } as unknown as ZephyrEngine;
}

const stats = {} as ZephyrBuildStats;

function dependencyPaths(
  files: readonly string[],
  contexts: readonly string[] = []
): XPackParticipantDependencyPaths {
  return {
    fileDependencies: files,
    contextDependencies: contexts,
    missingDependencies: [],
    buildDependencies: [],
  };
}

describe('XPackBuildCoordinator', () => {
  it('stores one normalized application base shared by every compiler', () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [
      { name: 'client' },
      { name: 'server' },
    ]);

    coordinator.registerParticipantBaseHref('client', '/docs/');
    coordinator.registerParticipantBaseHref('server', 'docs');

    expect(zephyrEngine.buildProperties.baseHref).toBe('docs');
  });

  it('normalizes missing and root compiler bases to the same empty application base', () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [
      { name: 'client' },
      { name: 'server' },
    ]);

    coordinator.registerParticipantBaseHref('client', undefined);
    coordinator.registerParticipantBaseHref('server', '/');

    expect(zephyrEngine.buildProperties.baseHref).toBe('');
  });

  it('ignores compiler base paths for tap-app packages', () => {
    const zephyrEngine = engine();
    zephyrEngine.env.target = 'tap-app';
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [
      { name: 'desktop' },
      { name: 'worker' },
    ]);

    coordinator.registerParticipantBaseHref('desktop', '/local/desktop/');
    coordinator.registerParticipantBaseHref('worker', '/local/worker/');

    expect(zephyrEngine.buildProperties.baseHref).toBe('');
  });

  it('rejects conflicting compiler bases before a coordinated build starts', () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [
      { name: 'client' },
      { name: 'server' },
    ]);

    coordinator.registerParticipantBaseHref('client', '/docs/');

    expect(() => coordinator.registerParticipantBaseHref('server', '/admin/')).toThrow(
      'conflicting application bases'
    );
    expect(zephyrEngine.upload_assets).not.toHaveBeenCalled();
  });

  it('publishes one merged snapshot only after every compiler completes', async () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(
      zephyrEngine,
      [
        { name: 'client', role: 'client' },
        { name: 'server', role: 'server' },
      ],
      { snapshotType: 'ssr', entrypoint: 'server/index.js' }
    );

    await coordinator.contribute({
      participant: 'client',
      assetsMap: asset('client/app.js', 'client-hash'),
      buildStats: stats,
      mfConfigs: [{ name: 'client' }],
    });
    expect(zephyrEngine.upload_assets).not.toHaveBeenCalled();

    await coordinator.contribute({
      participant: 'server',
      assetsMap: asset('server/index.js', 'server-hash'),
      buildStats: stats,
      mfConfigs: [{ name: 'server' }],
    });

    expect(zephyrEngine.upload_assets).toHaveBeenCalledTimes(1);
    expect(zephyrEngine.upload_assets).toHaveBeenCalledWith(
      expect.objectContaining({
        assetsMap: expect.objectContaining({
          'client-hash': expect.objectContaining({ path: 'client/app.js' }),
          'server-hash': expect.objectContaining({ path: 'server/index.js' }),
        }),
        snapshotType: 'ssr',
        entrypoint: 'server/index.js',
        mfConfigs: [{ name: 'client' }, { name: 'server' }],
      })
    );
    expect(zephyrEngine.build_finished).toHaveBeenCalledTimes(1);
  });

  it('retains every federation config from every compiler in the merged snapshot', async () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [
      { name: 'desktop' },
      { name: 'background' },
    ]);

    await coordinator.contribute({
      participant: 'desktop',
      assetsMap: asset('targets/desktop/remoteEntry.mjs', 'desktop-hash'),
      buildStats: {
        ...stats,
        federation: [
          { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' },
          { name: 'mobile', remote: 'targets/mobile/remoteEntry.mjs' },
        ],
      },
      mfConfigs: [
        { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
        { name: 'mobile', filename: 'targets/mobile/remoteEntry.mjs' },
      ],
    });

    await coordinator.contribute({
      participant: 'background',
      assetsMap: asset('targets/worker/remoteEntry.mjs', 'worker-hash'),
      buildStats: {
        ...stats,
        federation: [{ name: 'worker', remote: 'targets/worker/remoteEntry.mjs' }],
      },
      mfConfigs: [{ name: 'worker', filename: 'targets/worker/remoteEntry.mjs' }],
    });

    expect(zephyrEngine.upload_assets).toHaveBeenCalledWith(
      expect.objectContaining({
        mfConfigs: [
          { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
          { name: 'mobile', filename: 'targets/mobile/remoteEntry.mjs' },
          { name: 'worker', filename: 'targets/worker/remoteEntry.mjs' },
        ],
        buildStats: expect.objectContaining({
          federation: [
            { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' },
            { name: 'mobile', remote: 'targets/mobile/remoteEntry.mjs' },
            { name: 'worker', remote: 'targets/worker/remoteEntry.mjs' },
          ],
        }),
      })
    );
  });

  it('fails closed when a coordinated TAP package has no complete federation metadata', async () => {
    const zephyrEngine = engine();
    zephyrEngine.env.target = 'tap-app';
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [{ name: 'desktop' }]);

    await expect(
      coordinator.contribute({
        participant: 'desktop',
        assetsMap: asset('targets/desktop/remoteEntry.mjs', 'desktop-hash'),
        buildStats: { ...stats, federation: [] },
        mfConfigs: [],
      })
    ).rejects.toThrow('requires a non-empty mfConfigs metadata array');

    expect(zephyrEngine.upload_assets).not.toHaveBeenCalled();
  });

  it('deduplicates matching federation config copies across compilers', async () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [
      { name: 'client' },
      { name: 'server' },
    ]);
    const mfConfig = {
      name: 'shared',
      filename: 'targets/shared/remoteEntry.mjs',
      library: { type: 'module' },
    };
    const federation = {
      name: 'shared',
      remote: 'targets/shared/remoteEntry.mjs',
      library_type: 'module',
    };

    await coordinator.contribute({
      participant: 'client',
      assetsMap: asset('client/app.js', 'client-hash'),
      buildStats: { ...stats, federation: [federation] },
      mfConfigs: [mfConfig],
    });
    await coordinator.contribute({
      participant: 'server',
      assetsMap: asset('server/app.js', 'server-hash'),
      buildStats: { ...stats, federation: [{ ...federation }] },
      mfConfigs: [{ ...mfConfig, library: { type: 'module' } }],
    });

    expect(zephyrEngine.upload_assets).toHaveBeenCalledWith(
      expect.objectContaining({
        mfConfig,
        mfConfigs: [mfConfig],
        buildStats: expect.objectContaining({ federation: [federation] }),
      })
    );
  });

  it('rejects conflicting federation configs that claim the same container name', async () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [
      { name: 'desktop' },
      { name: 'worker' },
    ]);

    await coordinator.contribute({
      participant: 'desktop',
      assetsMap: asset('desktop/app.js', 'desktop-hash'),
      buildStats: stats,
      mfConfigs: [{ name: 'app', filename: 'targets/desktop/remoteEntry.mjs' }],
    });

    await expect(
      coordinator.contribute({
        participant: 'worker',
        assetsMap: asset('worker/app.js', 'worker-hash'),
        buildStats: stats,
        mfConfigs: [{ name: 'app', filename: 'targets/worker/remoteEntry.mjs' }],
      })
    ).rejects.toThrow('Conflicting Module Federation configuration for name:app.');
    expect(zephyrEngine.upload_assets).not.toHaveBeenCalled();
  });

  it('rejects cross-compiler path collisions before uploading', async () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [
      { name: 'client' },
      { name: 'server' },
    ]);

    await coordinator.contribute({
      participant: 'client',
      assetsMap: asset('main.js', 'client-hash'),
      buildStats: stats,
    });
    await expect(
      coordinator.contribute({
        participant: 'server',
        assetsMap: asset('main.js', 'server-hash'),
        buildStats: stats,
      })
    ).rejects.toThrow('Conflicting assets');
    expect(zephyrEngine.upload_assets).not.toHaveBeenCalled();
  });

  it('rejects an SSR entrypoint that was not emitted', async () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(
      zephyrEngine,
      [{ name: 'client' }, { name: 'server' }],
      { snapshotType: 'ssr', entrypoint: 'server/missing.js' }
    );

    await coordinator.contribute({
      participant: 'client',
      assetsMap: asset('client/app.js', 'client-hash'),
      buildStats: stats,
    });
    await expect(
      coordinator.contribute({
        participant: 'server',
        assetsMap: asset('server/index.js', 'server-hash'),
        buildStats: stats,
      })
    ).rejects.toThrow('was not emitted');
    expect(zephyrEngine.upload_assets).not.toHaveBeenCalled();
  });

  it('publishes isolated watch generations and starts one new engine build', async () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [
      { name: 'client' },
      { name: 'server' },
    ]);

    for (const generation of [0, 1]) {
      coordinator.beginParticipant('client', generation);
      coordinator.beginParticipant('server', generation);
      await coordinator.contribute({
        participant: 'client',
        generation,
        assetsMap: asset(`client/app-${generation}.js`, `client-${generation}`),
        buildStats: stats,
      });
      await coordinator.contribute({
        participant: 'server',
        generation,
        assetsMap: asset(`server/app-${generation}.js`, `server-${generation}`),
        buildStats: stats,
      });
    }

    expect(zephyrEngine.upload_assets).toHaveBeenCalledTimes(2);
    expect(zephyrEngine.build_finished).toHaveBeenCalledTimes(2);
    expect(zephyrEngine.start_new_build).toHaveBeenCalledTimes(1);
    expect(zephyrEngine.upload_assets).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        assetsMap: expect.objectContaining({
          'client-1': expect.objectContaining({ path: 'client/app-1.js' }),
          'server-1': expect.objectContaining({ path: 'server/app-1.js' }),
        }),
      })
    );
  });

  it('carries forward an unchanged server when only the client rebuilds', async () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [
      { name: 'client' },
      { name: 'server' },
    ]);

    coordinator.beginParticipant('client', 0);
    coordinator.beginParticipant('server', 0);
    await coordinator.contribute({
      participant: 'client',
      generation: 0,
      assetsMap: asset('client/old.js', 'client-old'),
      buildStats: stats,
    });
    await coordinator.contribute({
      participant: 'server',
      generation: 0,
      assetsMap: asset('server/unchanged.js', 'server-unchanged'),
      buildStats: stats,
    });

    coordinator.beginParticipant('client', 1);
    await coordinator.contribute({
      participant: 'client',
      generation: 1,
      assetsMap: asset('client/new.js', 'client-new'),
      buildStats: stats,
    });

    expect(zephyrEngine.upload_assets).toHaveBeenCalledTimes(2);
    expect(zephyrEngine.upload_assets).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        assetsMap: {
          'client-new': expect.objectContaining({ path: 'client/new.js' }),
          'server-unchanged': expect.objectContaining({
            path: 'server/unchanged.js',
          }),
        },
      })
    );
    expect(zephyrEngine.start_new_build).toHaveBeenCalledTimes(1);
  });

  it('holds a sequential watch batch until every invalidated compiler contributes', async () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [
      { name: 'client' },
      { name: 'server' },
    ]);

    coordinator.beginParticipant('client', 0);
    coordinator.beginParticipant('server', 0);
    await coordinator.contribute({
      participant: 'client',
      generation: 0,
      assetsMap: asset('client/old.js', 'client-old'),
      buildStats: stats,
    });
    await coordinator.contribute({
      participant: 'server',
      generation: 0,
      assetsMap: asset('server/old.js', 'server-old'),
      buildStats: stats,
    });

    // Both invalidations are known before parallelism=1 starts the first child.
    coordinator.beginBatch(['client', 'server']);
    coordinator.beginParticipant('client', 1);
    await coordinator.contribute({
      participant: 'client',
      generation: 1,
      assetsMap: asset('client/new.js', 'client-new'),
      buildStats: stats,
    });
    expect(zephyrEngine.upload_assets).toHaveBeenCalledTimes(1);

    // The server starts only after the client hook has completed.
    coordinator.beginParticipant('server', 1);
    await coordinator.contribute({
      participant: 'server',
      generation: 1,
      assetsMap: asset('server/new.js', 'server-new'),
      buildStats: stats,
    });
    expect(zephyrEngine.upload_assets).toHaveBeenCalledTimes(2);
    expect(zephyrEngine.upload_assets).toHaveBeenLastCalledWith(
      expect.objectContaining({
        assetsMap: expect.objectContaining({
          'client-new': expect.any(Object),
          'server-new': expect.any(Object),
        }),
      })
    );

    // A later client-only batch legitimately reuses the last successful server.
    coordinator.beginBatch(['client']);
    coordinator.beginParticipant('client', 2);
    await coordinator.contribute({
      participant: 'client',
      generation: 2,
      assetsMap: asset('client/latest.js', 'client-latest'),
      buildStats: stats,
    });
    expect(zephyrEngine.upload_assets).toHaveBeenCalledTimes(3);
    expect(zephyrEngine.upload_assets).toHaveBeenLastCalledWith(
      expect.objectContaining({
        assetsMap: expect.objectContaining({
          'client-latest': expect.any(Object),
          'server-new': expect.any(Object),
        }),
      })
    );
  });

  it('uses dependency metadata before a late sibling invalid hook can publish stale output', async () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [
      { name: 'client' },
      { name: 'server' },
    ]);
    const sharedFile = '/repo/src/shared.ts';
    const clientDependencies = dependencyPaths([sharedFile, '/repo/src/client.ts']);
    const serverDependencies = dependencyPaths([sharedFile, '/repo/src/server.ts']);

    coordinator.beginParticipant('client', 0);
    coordinator.beginParticipant('server', 0);
    await coordinator.contribute({
      participant: 'client',
      generation: 0,
      assetsMap: asset('client/old.js', 'client-old'),
      buildStats: stats,
      dependencyPaths: clientDependencies,
    });
    await coordinator.contribute({
      participant: 'server',
      generation: 0,
      assetsMap: asset('server/old.js', 'server-old'),
      buildStats: stats,
      dependencyPaths: serverDependencies,
    });

    // Production ordering with parallelism=1: only the client invalid hook has fired.
    coordinator.invalidateParticipant('client', sharedFile);
    coordinator.beginParticipant('client', 1);
    await coordinator.contribute({
      participant: 'client',
      generation: 1,
      assetsMap: asset('client/new.js', 'client-new'),
      buildStats: stats,
      dependencyPaths: clientDependencies,
    });
    expect(zephyrEngine.upload_assets).toHaveBeenCalledTimes(1);

    // The server hook and compilation arrive only after the client has contributed.
    coordinator.invalidateParticipant('server', sharedFile);
    coordinator.beginParticipant('server', 1);
    await coordinator.contribute({
      participant: 'server',
      generation: 1,
      assetsMap: asset('server/new.js', 'server-new'),
      buildStats: stats,
      dependencyPaths: serverDependencies,
    });

    expect(zephyrEngine.upload_assets).toHaveBeenCalledTimes(2);
    expect(zephyrEngine.upload_assets).toHaveBeenLastCalledWith(
      expect.objectContaining({
        assetsMap: expect.objectContaining({
          'client-new': expect.any(Object),
          'server-new': expect.any(Object),
        }),
      })
    );
  });

  it('conservatively invalidates all participants when the filename is unknown', async () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [
      { name: 'client' },
      { name: 'server' },
    ]);

    coordinator.beginParticipant('client', 0);
    coordinator.beginParticipant('server', 0);
    await coordinator.contribute({
      participant: 'client',
      generation: 0,
      assetsMap: asset('client/old.js', 'client-old'),
      buildStats: stats,
      dependencyPaths: dependencyPaths(['/repo/client.ts']),
    });
    await coordinator.contribute({
      participant: 'server',
      generation: 0,
      assetsMap: asset('server/old.js', 'server-old'),
      buildStats: stats,
      dependencyPaths: dependencyPaths(['/repo/server.ts']),
    });

    coordinator.invalidateParticipant('client', null);
    coordinator.beginParticipant('client', 1);
    await coordinator.contribute({
      participant: 'client',
      generation: 1,
      assetsMap: asset('client/new.js', 'client-new'),
      buildStats: stats,
      dependencyPaths: dependencyPaths(['/repo/client.ts']),
    });
    expect(zephyrEngine.upload_assets).toHaveBeenCalledTimes(1);
  });

  it('fails the shared session and resets the engine when a compiler fails', () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [
      { name: 'client' },
      { name: 'server' },
    ]);
    coordinator.beginParticipant('client', 0);

    coordinator.failParticipant('client', new Error('compile failed'));

    expect(zephyrEngine.build_failed).toHaveBeenCalledTimes(1);
    expect(zephyrEngine.upload_assets).not.toHaveBeenCalled();
  });

  it('rejects late siblings from a failed batch instead of publishing stale output', async () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [
      { name: 'client' },
      { name: 'server' },
    ]);
    const sharedFile = '/repo/src/shared.ts';
    const dependencies = dependencyPaths([sharedFile]);

    coordinator.beginParticipant('client', 0);
    coordinator.beginParticipant('server', 0);
    await coordinator.contribute({
      participant: 'client',
      generation: 0,
      assetsMap: asset('client/old.js', 'client-old'),
      buildStats: stats,
      dependencyPaths: dependencies,
    });
    await coordinator.contribute({
      participant: 'server',
      generation: 0,
      assetsMap: asset('server/old.js', 'server-old'),
      buildStats: stats,
      dependencyPaths: dependencies,
    });

    coordinator.invalidateParticipant('client', sharedFile);
    coordinator.beginParticipant('client', 1);
    coordinator.failParticipant('client', new Error('client compilation failed'));

    expect(() => coordinator.beginParticipant('server', 1)).toThrow(
      'belongs to a failed logical build'
    );
    expect(zephyrEngine.upload_assets).toHaveBeenCalledTimes(1);

    coordinator.invalidateParticipant('client', sharedFile);
    coordinator.beginParticipant('client', 2);
    await coordinator.contribute({
      participant: 'client',
      generation: 2,
      assetsMap: asset('client/recovered.js', 'client-recovered'),
      buildStats: stats,
      dependencyPaths: dependencies,
    });
    expect(zephyrEngine.upload_assets).toHaveBeenCalledTimes(1);

    coordinator.invalidateParticipant('server', sharedFile);
    coordinator.beginParticipant('server', 2);
    await coordinator.contribute({
      participant: 'server',
      generation: 2,
      assetsMap: asset('server/recovered.js', 'server-recovered'),
      buildStats: stats,
      dependencyPaths: dependencies,
    });

    expect(zephyrEngine.upload_assets).toHaveBeenCalledTimes(2);
    expect(zephyrEngine.upload_assets).toHaveBeenLastCalledWith(
      expect.objectContaining({
        assetsMap: expect.objectContaining({
          'client-recovered': expect.any(Object),
          'server-recovered': expect.any(Object),
        }),
      })
    );
  });

  it('invalidates transitive MultiCompiler dependents from the config graph', async () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [
      { name: 'client' },
      { name: 'server', dependencies: ['client'] },
    ]);

    coordinator.beginParticipant('client', 0);
    coordinator.beginParticipant('server', 0);
    await coordinator.contribute({
      participant: 'client',
      generation: 0,
      assetsMap: asset('client/old.js', 'client-old'),
      buildStats: stats,
      dependencyPaths: dependencyPaths(['/repo/src/client.ts']),
    });
    await coordinator.contribute({
      participant: 'server',
      generation: 0,
      assetsMap: asset('server/old.js', 'server-old'),
      buildStats: stats,
      dependencyPaths: dependencyPaths(['/repo/src/server.ts']),
    });

    coordinator.invalidateParticipant('client', '/repo/src/client.ts');
    coordinator.beginParticipant('client', 1);
    await coordinator.contribute({
      participant: 'client',
      generation: 1,
      assetsMap: asset('client/new.js', 'client-new'),
      buildStats: stats,
      dependencyPaths: dependencyPaths(['/repo/src/client.ts']),
    });

    expect(zephyrEngine.upload_assets).toHaveBeenCalledTimes(1);
  });

  it('rejects stale compiler generations instead of mixing watch output', async () => {
    const zephyrEngine = engine();
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [
      { name: 'client' },
      { name: 'server' },
    ]);

    coordinator.beginParticipant('client', 0);
    coordinator.beginParticipant('server', 0);
    await coordinator.contribute({
      participant: 'client',
      generation: 0,
      assetsMap: asset('client/old.js', 'client-old'),
      buildStats: stats,
    });
    coordinator.beginParticipant('client', 1);
    await coordinator.contribute({
      participant: 'client',
      generation: 1,
      assetsMap: asset('client/new.js', 'client-new'),
      buildStats: stats,
    });

    await expect(
      coordinator.contribute({
        participant: 'server',
        generation: 0,
        assetsMap: asset('server/old.js', 'server-old'),
        buildStats: stats,
      })
    ).rejects.toThrow(/stale/i);
    expect(zephyrEngine.upload_assets).not.toHaveBeenCalled();
  });

  it('derives client/server roles and output-relative prefixes', () => {
    const zephyrEngine = engine();
    const { compilers } = coordinateXPackCompilers(zephyrEngine, [
      { name: 'web', target: 'web', output: { path: '/repo/dist/client' } },
      { name: 'node', target: 'node', output: { path: '/repo/dist/server' } },
    ]);

    expect(compilers).toEqual([
      { participant: 'web', role: 'client', assetPrefix: 'client' },
      { participant: 'node', role: 'server', assetPrefix: 'server' },
    ]);
  });

  it('does not prefix distinct TAP target output directories', () => {
    const zephyrEngine = engine();
    zephyrEngine.env.target = 'tap-app';
    const { compilers } = coordinateXPackCompilers(zephyrEngine, [
      {
        name: 'desktop',
        target: 'web',
        output: { path: '/repo/dist/targets/desktop' },
      },
      {
        name: 'worker',
        target: 'node',
        output: { path: '/repo/dist/targets/worker' },
      },
    ]);

    expect(compilers).toEqual([
      { participant: 'desktop', role: 'client', assetPrefix: undefined },
      { participant: 'worker', role: 'server', assetPrefix: undefined },
    ]);
  });

  it('defaults a desktop plus QuickJS TAP package to CSR without a server entrypoint', async () => {
    const zephyrEngine = engine();
    zephyrEngine.env.target = 'tap-app';
    const { coordinator } = coordinateXPackCompilers(zephyrEngine, [
      { name: 'desktop', target: 'web' },
      { name: 'quickjs', target: 'node' },
    ]);

    await coordinator.contribute({
      participant: 'desktop',
      assetsMap: asset('targets/desktop/remoteEntry.mjs', 'desktop-entry'),
      buildStats: {
        ...stats,
        federation: [{ name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' }],
      },
      mfConfigs: [{ name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' }],
    });
    await coordinator.contribute({
      participant: 'quickjs',
      assetsMap: asset('targets/quickjs/remoteEntry.mjs', 'quickjs-entry'),
      buildStats: {
        ...stats,
        federation: [{ name: 'quickjs', remote: 'targets/quickjs/remoteEntry.mjs' }],
      },
      mfConfigs: [{ name: 'quickjs', filename: 'targets/quickjs/remoteEntry.mjs' }],
    });

    expect(zephyrEngine.upload_assets).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotType: 'csr',
        entrypoint: undefined,
      })
    );
  });

  it('rejects noncanonical TAP artifact paths before coordinating an upload', async () => {
    const zephyrEngine = engine();
    zephyrEngine.env.target = 'tap-app';
    const coordinator = new XPackBuildCoordinator(zephyrEngine, [{ name: 'desktop' }]);

    await expect(
      coordinator.contribute({
        participant: 'desktop',
        assetsMap: asset('targets\\desktop\\remoteEntry.mjs', 'sdk-locked-hash'),
        buildStats: stats,
      })
    ).rejects.toThrow('canonical snapshot spelling');

    expect(zephyrEngine.upload_assets).not.toHaveBeenCalled();
  });

  it('matches only supported server targets', () => {
    const zephyrEngine = engine();
    const { compilers } = coordinateXPackCompilers(zephyrEngine, [
      { name: 'node-version', target: 'node22.12' },
      { name: 'async-node', target: 'async-node' },
      { name: 'electron', target: 'electron-main' },
      { name: 'browser', target: 'web-electron-main' },
    ]);

    expect(compilers.map(({ role }) => role)).toEqual([
      'server',
      'server',
      'server',
      'client',
    ]);
  });
});
