import {
  normalizeBasePath,
  joinBasePath,
  detectBasePathFromWebpack,
  transformAssetPathsWithBase
} from './basepath-handler';

describe('normalizeBasePath', () => {
  test('handles empty and special cases', () => {
    expect(normalizeBasePath('')).toBe('');
    expect(normalizeBasePath('/')).toBe('');
    expect(normalizeBasePath('./')).toBe('');
    expect(normalizeBasePath('.')).toBe('');
  });

  test('removes leading and trailing slashes', () => {
    expect(normalizeBasePath('js')).toBe('js');
    expect(normalizeBasePath('/js')).toBe('js');
    expect(normalizeBasePath('js/')).toBe('js');
    expect(normalizeBasePath('/js/')).toBe('js');
    expect(normalizeBasePath('//js//')).toBe('js');
  });

  test('handles nested paths', () => {
    expect(normalizeBasePath('/apps/my-app/')).toBe('apps/my-app');
    expect(normalizeBasePath('apps/my-app')).toBe('apps/my-app');
  });
});

describe('joinBasePath', () => {
  test('handles empty asset paths', () => {
    expect(joinBasePath('js', '')).toBe('');
  });

  test('does not modify absolute or URL asset paths', () => {
    expect(joinBasePath('js', '/assets/main.js')).toBe('/assets/main.js');
    expect(joinBasePath('js', 'http://example.com/assets/main.js')).toBe('http://example.com/assets/main.js');
    expect(joinBasePath('js', '//example.com/assets/main.js')).toBe('//example.com/assets/main.js');
  });

  test('correctly joins base path with asset path', () => {
    expect(joinBasePath('js', 'assets/main.js')).toBe('js/assets/main.js');
    expect(joinBasePath('/js/', 'assets/main.js')).toBe('js/assets/main.js');
    expect(joinBasePath('/js', 'assets/main.js')).toBe('js/assets/main.js');
    expect(joinBasePath('apps/my-app', 'assets/main.js')).toBe('apps/my-app/assets/main.js');
  });

  test('returns original asset path when base is empty', () => {
    expect(joinBasePath('', 'assets/main.js')).toBe('assets/main.js');
    expect(joinBasePath('/', 'assets/main.js')).toBe('assets/main.js');
    expect(joinBasePath('./', 'assets/main.js')).toBe('assets/main.js');
  });
});

describe('detectBasePathFromWebpack', () => {
  test('prioritizes plugin options', () => {
    const config = {
      output: { publicPath: '/public/' },
      plugins: [
        { constructor: { name: 'HtmlWebpackPlugin' }, options: { base: { href: '/html-base/' } } }
      ]
    };
    
    expect(detectBasePathFromWebpack(config, { baseHref: { path: '/plugin-base/' } }))
      .toBe('/plugin-base/');
  });

  test('uses HTML plugin base.href when no plugin option', () => {
    const config = {
      output: { publicPath: '/public/' },
      plugins: [
        { constructor: { name: 'HtmlWebpackPlugin' }, options: { base: { href: '/html-base/' } } }
      ]
    };
    
    expect(detectBasePathFromWebpack(config)).toBe('/html-base/');
  });

  test('falls back to output.publicPath when no other options', () => {
    const config = {
      output: { publicPath: '/public/' }
    };
    
    expect(detectBasePathFromWebpack(config)).toBe('/public/');
  });

  test('returns empty string when no base path found', () => {
    const config = {
      output: { publicPath: 'auto' }
    };
    
    expect(detectBasePathFromWebpack(config)).toBe('');
  });
});

describe('transformAssetPathsWithBase', () => {
  test('returns original map when no base path', () => {
    const assetsMap = {
      'hash1': { filepath: 'assets/main.js' },
      'hash2': { filepath: 'assets/style.css' }
    };
    
    expect(transformAssetPathsWithBase(assetsMap)).toEqual(assetsMap);
  });

  test('transforms all asset paths with base path', () => {
    const assetsMap = {
      'hash1': { filepath: 'assets/main.js' },
      'hash2': { filepath: 'assets/style.css' },
      'hash3': { filepath: '/absolute/path.js' }
    };
    
    const expected = {
      'hash1': { filepath: 'js/assets/main.js' },
      'hash2': { filepath: 'js/assets/style.css' },
      'hash3': { filepath: '/absolute/path.js' }
    };
    
    expect(transformAssetPathsWithBase(assetsMap, 'js')).toEqual(expected);
  });

  test('handles nested base paths', () => {
    const assetsMap = {
      'hash1': { filepath: 'assets/main.js' }
    };
    
    const expected = {
      'hash1': { filepath: 'apps/my-app/assets/main.js' }
    };
    
    expect(transformAssetPathsWithBase(assetsMap, 'apps/my-app')).toEqual(expected);
  });
});