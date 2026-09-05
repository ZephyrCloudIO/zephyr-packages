import { describe, expect, it } from '@rstest/core';
import { createRequire } from 'node:module';
import {
  buildVersionedDependencyMap,
  resolveInstalledPackageVersion,
} from './find-package-json';

describe('buildVersionedDependencyMap', () => {
  it('uses installed major and minor versions in dashboard dependency keys', () => {
    const packageJson = {
      dependencies: {
        react: '^19.0.0',
        'react-dom': '^19.0.0',
      },
    };
    const versions = new Map([
      ['react', '19.2.8'],
      ['react-dom', '19.2.8-canary.4+sha.abc'],
    ]);

    expect(
      buildVersionedDependencyMap(packageJson, 'dependencies', (name) =>
        versions.get(name)
      )
    ).toEqual({
      'react-19.2': 'react',
      'react-dom-19.2': 'react-dom',
    });
  });

  it('omits packages that are not installed', () => {
    expect(
      buildVersionedDependencyMap(
        { optionalDependencies: { sharp: '^0.35.0' } },
        'optionalDependencies',
        () => undefined
      )
    ).toEqual({});
  });

  it('returns an empty map for a missing dependency group', () => {
    expect(buildVersionedDependencyMap({}, 'devDependencies', () => '1.0.0')).toEqual({});
  });

  it('reads versions from installed type-only packages', () => {
    expect(
      resolveInstalledPackageVersion(
        '@types/node-persist',
        createRequire(import.meta.url)
      )
    ).toMatch(/^3\./);
  });
});
