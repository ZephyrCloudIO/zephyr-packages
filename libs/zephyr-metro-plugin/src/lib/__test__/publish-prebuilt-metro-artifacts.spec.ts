import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

const state = rs.hoisted(() => ({
  engines: [] as Array<Record<string, unknown>>,
  failTarget: '',
}));
rs.mock('zephyr-agent', () => {
  const actual = rs.requireActual('zephyr-agent') as Record<string, unknown>;
  return {
    ...actual,
    ze_log: { config: rs.fn(), app: rs.fn(), error: rs.fn(), manifest: rs.fn() },
    ZephyrEngine: {
      create: rs.fn(async () => {
        const engine: Record<string, unknown> = {
          env: { target: 'ios' },
          applicationProperties: { name: 'PrebuiltFixture' },
          application_uid: `application-${state.engines.length}`,
          npmProperties: {
            dependencies: {},
            devDependencies: {},
            optionalDependencies: {},
            peerDependencies: {},
          },
          resolve_remote_dependencies: rs.fn(async () => []),
          build_id: `build-${state.engines.length}`,
          snapshotId: `snapshot-${state.engines.length}`,
          version_url: `https://zephyr.example.test/version-${state.engines.length}`,
          hasActiveBuild: true,
          start_new_build: rs.fn(async () => {
            engine.hasActiveBuild = true;
          }),
          upload_assets: rs.fn(async () => {
            if (
              engine.env &&
              (engine.env as { target: string }).target === state.failTarget
            )
              throw new Error('fixture upload failed');
          }),
          build_finished: rs.fn(async () => {
            engine.hasActiveBuild = false;
            engine.application_uid = '';
            engine.build_id = '';
            engine.snapshotId = '';
            engine.version_url = '';
          }),
          build_failed: rs.fn(async () => {
            engine.hasActiveBuild = false;
          }),
        };
        state.engines.push(engine);
        return engine;
      }),
    },
  };
});
rs.mock('../internal/extract-mf-remotes', () => ({
  extract_remotes_dependencies: rs.fn(() => []),
}));
rs.mock('../internal/mutate-mf-config', () => ({ mutateMfConfig: rs.fn() }));
rs.mock('../internal/metro-build-stats', () => ({
  createMinimalBuildStats: rs.fn(async () => ({})),
  resolveCatalogDependencies: rs.fn((value) => value),
}));
rs.mock('../internal/extract-modules-from-exposes', () => ({
  extractModulesFromExposes: rs.fn(() => []),
}));
rs.mock('../internal/get-package-dependencies', () => ({
  getPackageDependencies: rs.fn(() => []),
}));
rs.mock('../internal/parse-shared-dependencies', () => ({
  parseSharedDependencies: rs.fn(() => ({})),
}));

import {
  PrebuiltMetroPublishError,
  publishPrebuiltMetroArtifacts,
} from '../publish-prebuilt-metro-artifacts';

const sha256 = (value: Buffer | string) =>
  createHash('sha256').update(value).digest('hex');
let root: string;
let artifactDirectory: string;
let mfConfig: {
  name: string;
  filename: string;
  exposes: Record<string, string>;
  remotes: Record<string, string>;
  shared: Record<string, unknown>;
};
let entry: Buffer;
let card: Buffer;

async function createFixture() {
  root = await mkdtemp(path.join(tmpdir(), 'zephyr-prebuilt-'));
  artifactDirectory = path.join(root, 'ios');
  await mkdir(path.join(artifactDirectory, 'exposed'), { recursive: true });
  entry = Buffer.from('fixture native remote entry');
  card = Buffer.from('fixture exposed card');
  const manifest = {
    name: 'MFExampleMini',
    metaData: {
      name: 'MFExampleMini',
      publicPath: 'auto',
      remoteEntry: { name: 'mini.bundle', path: '' },
      buildInfo: { hash: sha256(entry) },
    },
    exposes: [
      {
        name: 'StatsCard',
        hash: sha256(card),
        assets: { js: { sync: ['./src/StatsCard.tsx'], async: [] } },
      },
    ],
    shared: [],
    remotes: [],
  };
  await writeFile(
    path.join(artifactDirectory, 'mf-manifest.json'),
    JSON.stringify(manifest)
  );
  await writeFile(path.join(artifactDirectory, 'mini.bundle'), entry);
  await writeFile(path.join(artifactDirectory, 'exposed/StatsCard.bundle'), card);
  mfConfig = {
    name: 'MFExampleMini',
    filename: 'mini.bundle',
    exposes: { './StatsCard': './src/StatsCard.tsx' },
    remotes: {},
    shared: {},
  };
}

describe('publishPrebuiltMetroArtifacts', () => {
  beforeEach(async () => {
    state.engines.length = 0;
    state.failTarget = '';
    await createFixture();
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('publishes the same verified raw artifacts to each explicit target and captures identity before cleanup', async () => {
    const results = await publishPrebuiltMetroArtifacts({
      context: root,
      artifactDirectory,
      mfConfig,
      targets: ['ios', 'android'],
    });
    expect(results).toEqual([
      {
        target: 'ios',
        applicationUid: 'application-0',
        buildId: 'build-0',
        snapshotId: 'snapshot-0',
        versionUrl: 'https://zephyr.example.test/version-0',
      },
      {
        target: 'android',
        applicationUid: 'application-1',
        buildId: 'build-1',
        snapshotId: 'snapshot-1',
        versionUrl: 'https://zephyr.example.test/version-1',
      },
    ]);
    expect(state.engines).toHaveLength(2);
    expect(
      state.engines.map((engine) => (engine.env as { target: string }).target)
    ).toEqual(['ios', 'android']);
    expect(
      state.engines[0]?.build_finished as ReturnType<typeof rs.fn>
    ).toHaveBeenCalledTimes(1);
    expect(
      state.engines[1]?.build_finished as ReturnType<typeof rs.fn>
    ).toHaveBeenCalledTimes(1);
  });

  it('rejects a missing declared executable before starting any publication', async () => {
    await rm(path.join(artifactDirectory, 'exposed/StatsCard.bundle'));
    await expect(
      publishPrebuiltMetroArtifacts({
        context: root,
        artifactDirectory,
        mfConfig,
        targets: ['ios'],
      })
    ).rejects.toThrow(
      'MF manifest declares missing executable: exposed/StatsCard.bundle'
    );
    expect(state.engines).toHaveLength(0);
  });

  it('returns completed identities when a later target upload fails and reports the failed target', async () => {
    state.failTarget = 'android';
    let failure: unknown;
    try {
      await publishPrebuiltMetroArtifacts({
        context: root,
        artifactDirectory,
        mfConfig,
        targets: ['ios', 'android'],
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(PrebuiltMetroPublishError);
    const publishError = failure as PrebuiltMetroPublishError;
    expect(publishError.target).toBe('android');
    expect(publishError.completed).toEqual([
      {
        target: 'ios',
        applicationUid: 'application-0',
        buildId: 'build-0',
        snapshotId: 'snapshot-0',
        versionUrl: 'https://zephyr.example.test/version-0',
      },
    ]);
    expect(
      state.engines[1]?.build_failed as ReturnType<typeof rs.fn>
    ).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported multi-target remotes before creating engines', async () => {
    mfConfig.remotes = { another: 'another@https://other.test/remote.js' };
    await expect(
      publishPrebuiltMetroArtifacts({
        context: root,
        artifactDirectory,
        mfConfig,
        targets: ['ios', 'android'],
      })
    ).rejects.toThrow('does not support configured remotes');
    expect(state.engines).toHaveLength(0);
  });
});
