import { describe, expect, it } from '@rstest/core';
import { collectStaticAssets } from '../collect-static-assets';

const file = (pathname: string) => ({ pathname, filePath: `/abs/.next${pathname}` });

describe('collectStaticAssets', () => {
  it('keeps only /_next/static files and picks a build ID probe', () => {
    const result = collectStaticAssets(
      [
        file('/_next/static/chunks/main-abc.js'),
        file('/_next/static/chunks/main-abc.js.map'),
        file('/_next/static/build-1/_buildManifest.js'),
        file('/favicon.ico'),
        file('/about.html'),
      ],
      '',
      'build-1'
    );

    expect(Object.keys(result.files)).toEqual([
      '_next/static/chunks/main-abc.js',
      '_next/static/build-1/_buildManifest.js',
    ]);
    expect(result.files['_next/static/chunks/main-abc.js']).toBe(
      '/abs/.next/_next/static/chunks/main-abc.js'
    );
    expect(result.probe).toBe('/_next/static/build-1/_buildManifest.js');
  });

  it('respects basePath', () => {
    const result = collectStaticAssets(
      [file('/docs/_next/static/b/_ssgManifest.js'), file('/_next/static/x.js')],
      '/docs',
      'b'
    );

    expect(Object.keys(result.files)).toEqual(['docs/_next/static/b/_ssgManifest.js']);
    expect(result.probe).toBe('/docs/_next/static/b/_ssgManifest.js');
  });

  it('has no probe when the build ID folder is missing', () => {
    expect(
      collectStaticAssets([file('/_next/static/x.js')], '', 'b').probe
    ).toBeUndefined();
  });
});
