import { normalizeBasePath, joinBasePath, detectBasePathFromWebpack, transformAssetPathsWithBase } from './basepath-handler';

describe('basepath-handler', () => {
  describe('normalizeBasePath', () => {
    it('should handle empty, root, and special paths', () => {
      expect(normalizeBasePath('')).toBe('');
      expect(normalizeBasePath('/')).toBe('');
      expect(normalizeBasePath('./')).toBe('');
      expect(normalizeBasePath('.')).toBe('');
    });

    it('should remove leading and trailing slashes', () => {
      expect(normalizeBasePath('/app/')).toBe('app');
      expect(normalizeBasePath('//app//')).toBe('app');
      expect(normalizeBasePath('/app/sub/')).toBe('app/sub');
    });

    it('should preserve internal path structure', () => {
      expect(normalizeBasePath('app/sub/path')).toBe('app/sub/path');
      expect(normalizeBasePath('/app/sub/path')).toBe('app/sub/path');
    });
  });

  describe('joinBasePath', () => {
    it('should not modify absolute paths or URLs', () => {
      expect(joinBasePath('/base', '/absolute')).toBe('/absolute');
      expect(joinBasePath('/base', 'http://example.com')).toBe('http://example.com');
      expect(joinBasePath('/base', 'https://example.com')).toBe('https://example.com');
      expect(joinBasePath('/base', '//example.com')).toBe('//example.com');
    });

    it('should not modify asset paths when base is empty', () => {
      expect(joinBasePath('', 'asset.js')).toBe('asset.js');
      expect(joinBasePath('/', 'asset.js')).toBe('asset.js');
    });

    it('should handle empty asset paths', () => {
      expect(joinBasePath('/base', '')).toBe('');
    });

    it('should join base path with asset path correctly', () => {
      expect(joinBasePath('/app', 'asset.js')).toBe('app/asset.js');
      expect(joinBasePath('app/', 'asset.js')).toBe('app/asset.js');
      expect(joinBasePath('/app/', 'asset.js')).toBe('app/asset.js');
    });
  });

  describe('detectBasePathFromWebpack', () => {
    it('should prioritize plugin options', () => {
      const config = {
        output: { publicPath: '/output-path/' },
        plugins: [
          { 
            constructor: { name: 'HtmlWebpackPlugin' },
            options: { base: { href: '/html-path/' } }
          }
        ]
      };
      const pluginOptions = { baseHref: { path: '/plugin-path/' } };
      
      expect(detectBasePathFromWebpack(config, pluginOptions)).toBe('/plugin-path/');
    });

    it('should use HtmlWebpackPlugin base.href if plugin options are not provided', () => {
      const config = {
        output: { publicPath: '/output-path/' },
        plugins: [
          { 
            constructor: { name: 'HtmlWebpackPlugin' },
            options: { base: { href: '/html-path/' } }
          }
        ]
      };
      
      expect(detectBasePathFromWebpack(config)).toBe('/html-path/');
    });

    it('should use output.publicPath if HtmlWebpackPlugin is not configured', () => {
      const config = {
        output: { publicPath: '/output-path/' }
      };
      
      expect(detectBasePathFromWebpack(config)).toBe('/output-path/');
    });

    it('should not use output.publicPath if it is "auto"', () => {
      const config = {
        output: { publicPath: 'auto' }
      };
      
      expect(detectBasePathFromWebpack(config)).toBe('');
    });

    it('should return empty string if no base path is found', () => {
      const config = {};
      
      expect(detectBasePathFromWebpack(config)).toBe('');
    });
  });

  describe('transformAssetPathsWithBase', () => {
    it('should return original map if basePath is not provided', () => {
      const assetsMap = {
        'asset1': { path: 'file1.js', hash: 'hash1' },
        'asset2': { path: 'file2.js', hash: 'hash2' }
      };
      
      expect(transformAssetPathsWithBase(assetsMap)).toEqual(assetsMap);
    });

    it('should update filepath property with base path', () => {
      const assetsMap = {
        'asset1': { filepath: 'file1.js', hash: 'hash1' },
        'asset2': { filepath: 'file2.js', hash: 'hash2' }
      };
      
      const expected = {
        'asset1': { filepath: 'app/file1.js', hash: 'hash1' },
        'asset2': { filepath: 'app/file2.js', hash: 'hash2' }
      };
      
      expect(transformAssetPathsWithBase(assetsMap, '/app/')).toEqual(expected);
    });

    it('should update path property with base path', () => {
      const assetsMap = {
        'asset1': { path: 'file1.js', hash: 'hash1' },
        'asset2': { path: 'file2.js', hash: 'hash2' }
      };
      
      const expected = {
        'asset1': { path: 'app/file1.js', hash: 'hash1' },
        'asset2': { path: 'app/file2.js', hash: 'hash2' }
      };
      
      expect(transformAssetPathsWithBase(assetsMap, '/app/')).toEqual(expected);
    });

    it('should update both path and filepath properties if both exist', () => {
      const assetsMap = {
        'asset1': { path: 'file1.js', filepath: 'file1.js', hash: 'hash1' },
        'asset2': { path: 'file2.js', filepath: 'file2.js', hash: 'hash2' }
      };
      
      const expected = {
        'asset1': { path: 'app/file1.js', filepath: 'app/file1.js', hash: 'hash1' },
        'asset2': { path: 'app/file2.js', filepath: 'app/file2.js', hash: 'hash2' }
      };
      
      expect(transformAssetPathsWithBase(assetsMap, '/app/')).toEqual(expected);
    });

    it('should not modify assets without path or filepath properties', () => {
      const assetsMap = {
        'asset1': { hash: 'hash1' },
        'asset2': { content: 'content', hash: 'hash2' }
      };
      
      const expected = {
        'asset1': { hash: 'hash1' },
        'asset2': { content: 'content', hash: 'hash2' }
      };
      
      expect(transformAssetPathsWithBase(assetsMap, '/app/')).toEqual(expected);
    });

    it('should not modify absolute paths or URLs', () => {
      const assetsMap = {
        'asset1': { path: '/file1.js', hash: 'hash1' },
        'asset2': { path: 'https://example.com/file2.js', hash: 'hash2' },
        'asset3': { path: 'file3.js', hash: 'hash3' }
      };
      
      const expected = {
        'asset1': { path: '/file1.js', hash: 'hash1' },
        'asset2': { path: 'https://example.com/file2.js', hash: 'hash2' },
        'asset3': { path: 'app/file3.js', hash: 'hash3' }
      };
      
      expect(transformAssetPathsWithBase(assetsMap, '/app/')).toEqual(expected);
    });

    it('should not modify index.html paths', () => {
      const assetsMap = {
        'index.html': { path: 'index.html', hash: 'hash1' },
        'index': { filepath: 'index.html', hash: 'hash2' },
        'other.html': { path: 'other.html', hash: 'hash3' },
        'js': { path: 'main.js', hash: 'hash4' }
      };
      
      const expected = {
        'index.html': { path: 'index.html', hash: 'hash1' },
        'index': { filepath: 'index.html', hash: 'hash2' },
        'other.html': { path: 'app/other.html', hash: 'hash3' },
        'js': { path: 'app/main.js', hash: 'hash4' }
      };
      
      expect(transformAssetPathsWithBase(assetsMap, '/app/')).toEqual(expected);
    });
  });
});