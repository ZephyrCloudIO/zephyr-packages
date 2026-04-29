import { resolveMfManifestPath } from './resolve-mf-manifest-path';

describe('resolve-mf-manifest-path', () => {
  it('returns default mf manifest path when manifest config is omitted', () => {
    expect(resolveMfManifestPath(undefined)).toBe('mf-manifest.json');
  });

  it('returns undefined when manifest is disabled', () => {
    expect(resolveMfManifestPath(false)).toBeUndefined();
  });

  it('uses custom fileName and ensures json extension', () => {
    expect(resolveMfManifestPath({ fileName: 'custom-manifest' })).toBe(
      'custom-manifest.json'
    );
    expect(resolveMfManifestPath({ fileName: 'custom-manifest.json' })).toBe(
      'custom-manifest.json'
    );
  });

  it('joins filePath and fileName with normalized relative path', () => {
    expect(
      resolveMfManifestPath({
        filePath: './manifests',
        fileName: 'custom-mf',
      })
    ).toBe('manifests/custom-mf.json');
  });

  it('strips a leading slash from filePath', () => {
    expect(resolveMfManifestPath({ filePath: '/manifests' })).toBe(
      'manifests/mf-manifest.json'
    );
  });
});
