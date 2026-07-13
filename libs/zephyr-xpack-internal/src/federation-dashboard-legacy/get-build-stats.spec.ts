import { describe, expect, it } from '@rstest/core';
import {
  getBuildStats,
  getModuleFederationBuildMetadata,
  getModuleFederationConfigs,
} from './get-build-stats';
import { resolveFederationGraphConfiguration } from './utils/federation-dashboard-plugin/FederationDashboardPlugin';

describe('getModuleFederationBuildMetadata', () => {
  it('uses the immutable typed dash-data path for tap-app instead of legacy graph heuristics', async () => {
    const engine = {
      application_uid: 'org.project.tap',
      applicationProperties: {
        org: 'org',
        project: 'project',
        name: 'tap',
        version: '1.0.0',
      },
      gitProperties: {
        git: {
          name: 'Developer',
          email: 'developer@example.test',
          branch: 'main',
          commit: 'abc123',
          tags: [],
        },
      },
      env: { isCI: false, target: 'tap-app' },
      snapshotId: Promise.resolve('snapshot-1'),
      build_id: Promise.resolve('build-1'),
      application_configuration: Promise.resolve({
        EDGE_URL: 'https://edge.example.test',
        DELIMITER: '-',
        username: 'developer',
        email: 'developer@example.test',
      }),
      federated_dependencies: null,
      npmProperties: {},
      builder: 'rspack',
    };
    const stats = {
      get compilation() {
        throw new Error('tap-app must not invoke legacy dashboard graph processing');
      },
    };

    const result = await getBuildStats({
      stats: stats as never,
      stats_json: {} as never,
      pluginOptions: {
        zephyr_engine: engine as never,
        mfConfig: [
          {
            apply() {},
            _options: {
              name: 'desktop',
              filename: 'targets/desktop/remoteEntry.mjs',
              library: { type: 'module' },
            },
          },
          {
            apply() {},
            _options: {
              name: 'worker',
              filename: 'targets/worker/remoteEntry.mjs',
              library: { type: 'module' },
            },
          },
        ],
      },
      EDGE_URL: 'https://edge.example.test',
      DELIMITER: '-',
    });

    expect(result.build_target).toBe('tap-app');
    expect(result.project).toBe('tap');
    expect(result.remote).toBeUndefined();
    expect(result.federation).toEqual([
      expect.objectContaining({
        name: 'desktop',
        remote: 'targets/desktop/remoteEntry.mjs',
      }),
      expect.objectContaining({
        name: 'worker',
        remote: 'targets/worker/remoteEntry.mjs',
      }),
    ]);
    expect(result.modules).toEqual([]);
  });

  it('keeps every container in multi-config graph processing without selecting the first', () => {
    const graph = resolveFederationGraphConfiguration(
      [
        {
          apply() {},
          _options: {
            name: 'desktop',
            filename: 'targets/desktop/remoteEntry.mjs',
            remotes: { shell: 'shell@https://example.test/shell.mjs' },
          },
        },
        {
          apply() {},
          options: {
            config: {
              name: 'worker',
              filename: 'targets/worker/remoteEntry.mjs',
              remotes: [
                'shell@https://example.test/shell.mjs',
                'runtime@https://example.test/runtime.mjs',
              ],
            },
          },
        },
      ],
      { name: 'stale-single-container' },
      'tap-shell'
    );

    expect(graph.configurations).toEqual([
      expect.objectContaining({ name: 'desktop' }),
      expect.objectContaining({ name: 'worker' }),
    ]);
    expect(graph.graphConfiguration).toEqual({ name: 'tap-shell' });
    expect(graph.remoteNames).toEqual([
      'shell',
      'shell@https://example.test/shell.mjs',
      'runtime@https://example.test/runtime.mjs',
    ]);
  });

  it('publishes manifest, ESM library, exposes, and shared metadata', () => {
    const exposes = {
      './desktop': './src/desktop.ts',
      './mobile': './src/mobile.ts',
    };
    const shared = {
      '@tap/sdk': { singleton: true, requiredVersion: '^1.0.0' },
    };

    const metadata = getModuleFederationBuildMetadata({
      apply() {},
      _options: {
        name: 'planetscale',
        filename: 'remoteEntry.mjs',
        library: { type: 'module' },
        manifest: { filePath: 'federation', fileName: 'tap-app' },
        exposes,
        shared,
      },
    });

    expect(metadata).toEqual([
      {
        name: 'planetscale',
        remote: 'remoteEntry.mjs',
        mf_manifest: 'federation/tap-app.json',
        library_type: 'module',
        exposes,
        shared,
      },
    ]);
  });

  it('publishes every independent federation config instead of selecting the first', () => {
    const metadata = getModuleFederationBuildMetadata([
      {
        name: 'DesktopContainer',
        apply() {},
        _options: {
          name: 'desktop',
          filename: 'targets/desktop/remoteEntry.mjs',
          library: { type: 'module' },
          manifest: { filePath: 'targets/desktop', fileName: 'mf-manifest' },
          exposes: { './ui/desktop': './src/desktop.ts' },
        },
      },
      {
        name: 'WorkerContainer',
        apply() {},
        _options: {
          name: 'worker',
          filename: 'targets/worker/remoteEntry.mjs',
          library: { type: 'module' },
          manifest: { filePath: 'targets/worker', fileName: 'mf-manifest' },
          exposes: { './background': './src/background.ts' },
        },
      },
    ]);

    expect(metadata).toEqual([
      expect.objectContaining({
        name: 'desktop',
        remote: 'targets/desktop/remoteEntry.mjs',
        mf_manifest: 'targets/desktop/mf-manifest.json',
      }),
      expect.objectContaining({
        name: 'worker',
        remote: 'targets/worker/remoteEntry.mjs',
        mf_manifest: 'targets/worker/mf-manifest.json',
      }),
    ]);
  });

  it('copies every serializable config for the snapshot contract', () => {
    const plugin = {
      apply() {},
      _options: {
        name: 'desktop',
        filename: 'targets/desktop/remoteEntry.mjs',
        library: { type: 'module' },
        dts: { generateTypes: false },
      },
    };

    const configs = getModuleFederationConfigs([plugin]);

    expect(configs).toEqual([
      {
        name: 'desktop',
        filename: 'targets/desktop/remoteEntry.mjs',
        library: { type: 'module' },
        dts: { generateTypes: false },
      },
    ]);
    expect(configs[0]).not.toBe(plugin._options);
  });

  it('deduplicates exact repeated configs but rejects conflicting identities', () => {
    const desktop = {
      apply() {},
      _options: {
        name: 'desktop',
        filename: 'targets/desktop/remoteEntry.mjs',
      },
    };

    expect(getModuleFederationConfigs([desktop, { ...desktop, apply() {} }])).toEqual([
      desktop._options,
    ]);

    expect(() =>
      getModuleFederationBuildMetadata([
        desktop,
        {
          apply() {},
          _options: {
            name: 'desktop',
            filename: 'targets/worker/remoteEntry.mjs',
          },
        },
      ])
    ).toThrow('Conflicting Module Federation metadata for name:desktop.');
  });

  it('preserves an explicitly disabled manifest', () => {
    expect(
      getModuleFederationBuildMetadata({
        apply() {},
        _options: {
          name: 'legacy-only',
          manifest: false,
        },
      })
    ).toEqual([
      expect.objectContaining({
        mf_manifest: undefined,
        library_type: 'var',
      }),
    ]);
  });

  it('uses the default manifest only for an enhanced MF plugin', () => {
    expect(
      getModuleFederationBuildMetadata({
        name: 'RspackModuleFederationPlugin',
        apply() {},
        _options: { name: 'enhanced' },
      })
    ).toEqual([expect.objectContaining({ mf_manifest: 'mf-manifest.json' })]);

    expect(
      getModuleFederationBuildMetadata({
        apply() {},
        _options: { name: 'legacy' },
      })
    ).toEqual([expect.objectContaining({ mf_manifest: undefined })]);
  });
});
