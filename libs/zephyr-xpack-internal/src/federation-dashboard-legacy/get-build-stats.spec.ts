import { describe, expect, it } from '@rstest/core';
import { getModuleFederationBuildMetadata } from './get-build-stats';

describe('getModuleFederationBuildMetadata', () => {
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

    expect(metadata).toEqual({
      name: 'planetscale',
      remote: 'remoteEntry.mjs',
      mf_manifest: 'federation/tap-app.json',
      library_type: 'module',
      exposes,
      shared,
    });
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
    ).toMatchObject({
      mf_manifest: undefined,
      library_type: 'var',
    });
  });

  it('uses the default manifest only for an enhanced MF plugin', () => {
    expect(
      getModuleFederationBuildMetadata({
        name: 'RspackModuleFederationPlugin',
        apply() {},
        _options: { name: 'enhanced' },
      })
    ).toMatchObject({ mf_manifest: 'mf-manifest.json' });

    expect(
      getModuleFederationBuildMetadata({
        apply() {},
        _options: { name: 'legacy' },
      })
    ).toMatchObject({ mf_manifest: undefined });
  });
});
