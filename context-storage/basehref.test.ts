/**
 * BaseHref Implementation - Tests
 * 
 * This file contains tests for the BaseHref functionality.
 */

import {
  BasePathHandler,
  ViteBaseHandler,
  WebpackPathHandler,
  UrlConstructor,
  BaseHrefIntegration
} from './basehref-implementation-skeleton';

/**
 * Test suite for BasePathHandler
 */
describe('BasePathHandler', () => {
  describe('normalizePath', () => {
    it('should handle absolute paths', () => {
      expect(BasePathHandler.normalizePath('/assets/')).toBe('/assets/');
      expect(BasePathHandler.normalizePath('/api')).toBe('/api/');
    });

    it('should handle relative paths', () => {
      expect(BasePathHandler.normalizePath('./assets/')).toBe('./assets/');
      expect(BasePathHandler.normalizePath('assets')).toBe('./assets/');
    });

    it('should handle URLs', () => {
      expect(BasePathHandler.normalizePath('https://example.com/assets/')).toBe('https://example.com/assets/');
      expect(BasePathHandler.normalizePath('https://example.com/api')).toBe('https://example.com/api/');
    });

    it('should handle empty paths', () => {
      expect(BasePathHandler.normalizePath('')).toBe('./');
      expect(BasePathHandler.normalizePath('/')).toBe('/');
    });

    it('should ensure trailing slash', () => {
      expect(BasePathHandler.normalizePath('/assets')).toBe('/assets/');
      expect(BasePathHandler.normalizePath('./assets')).toBe('./assets/');
      expect(BasePathHandler.normalizePath('https://example.com/assets')).toBe('https://example.com/assets/');
    });
  });

  describe('isAbsolutePath', () => {
    it('should identify absolute paths', () => {
      expect(BasePathHandler.isAbsolutePath('/assets/')).toBe(true);
      expect(BasePathHandler.isAbsolutePath('/api/v1')).toBe(true);
    });

    it('should reject relative paths', () => {
      expect(BasePathHandler.isAbsolutePath('./assets/')).toBe(false);
      expect(BasePathHandler.isAbsolutePath('assets/')).toBe(false);
    });

    it('should identify URLs as absolute', () => {
      expect(BasePathHandler.isAbsolutePath('https://example.com/assets/')).toBe(true);
      expect(BasePathHandler.isAbsolutePath('http://localhost:3000/')).toBe(true);
    });
  });

  describe('isUrl', () => {
    it('should identify URLs', () => {
      expect(BasePathHandler.isUrl('https://example.com/assets/')).toBe(true);
      expect(BasePathHandler.isUrl('http://localhost:3000/')).toBe(true);
      expect(BasePathHandler.isUrl('//cdn.example.com/assets/')).toBe(true);
    });

    it('should reject non-URL paths', () => {
      expect(BasePathHandler.isUrl('/assets/')).toBe(false);
      expect(BasePathHandler.isUrl('./assets/')).toBe(false);
      expect(BasePathHandler.isUrl('assets/')).toBe(false);
    });
  });
});

/**
 * Test suite for ViteBaseHandler
 */
describe('ViteBaseHandler', () => {
  describe('extractBaseFromConfig', () => {
    it('should extract base from Vite config', () => {
      const config = { base: '/app/' };
      expect(ViteBaseHandler.extractBaseFromConfig(config)).toBe('/app/');
    });

    it('should handle empty base', () => {
      const config = { base: '' };
      expect(ViteBaseHandler.extractBaseFromConfig(config)).toBe('./');
    });

    it('should handle undefined base', () => {
      const config = {};
      expect(ViteBaseHandler.extractBaseFromConfig(config)).toBe('./');
    });

    it('should normalize the extracted base', () => {
      const config = { base: '/app' };
      expect(ViteBaseHandler.extractBaseFromConfig(config)).toBe('/app/');
    });

    it('should handle URL bases', () => {
      const config = { base: 'https://cdn.example.com/app/' };
      expect(ViteBaseHandler.extractBaseFromConfig(config)).toBe('https://cdn.example.com/app/');
    });
  });

  describe('applyBaseToManifest', () => {
    it('should add base to manifest', () => {
      const manifest = {};
      const base = '/app/';
      const result = ViteBaseHandler.applyBaseToManifest(manifest, base);
      expect(result.baseHref).toBe('/app/');
    });

    it('should override existing base in manifest', () => {
      const manifest = { baseHref: '/old/' };
      const base = '/app/';
      const result = ViteBaseHandler.applyBaseToManifest(manifest, base);
      expect(result.baseHref).toBe('/app/');
    });

    it('should not modify the original manifest', () => {
      const manifest = {};
      const base = '/app/';
      ViteBaseHandler.applyBaseToManifest(manifest, base);
      expect(manifest.baseHref).toBeUndefined();
    });
  });
});

/**
 * Test suite for WebpackPathHandler
 */
describe('WebpackPathHandler', () => {
  describe('extractPublicPathFromConfig', () => {
    it('should extract publicPath from Webpack config', () => {
      const config = { output: { publicPath: '/app/' } };
      expect(WebpackPathHandler.extractPublicPathFromConfig(config)).toBe('/app/');
    });

    it('should handle empty publicPath', () => {
      const config = { output: { publicPath: '' } };
      expect(WebpackPathHandler.extractPublicPathFromConfig(config)).toBe('./');
    });

    it('should handle undefined publicPath', () => {
      const config = { output: {} };
      expect(WebpackPathHandler.extractPublicPathFromConfig(config)).toBe('./');
    });

    it('should handle missing output', () => {
      const config = {};
      expect(WebpackPathHandler.extractPublicPathFromConfig(config)).toBe('./');
    });

    it('should normalize the extracted publicPath', () => {
      const config = { output: { publicPath: '/app' } };
      expect(WebpackPathHandler.extractPublicPathFromConfig(config)).toBe('/app/');
    });

    it('should handle URL publicPath', () => {
      const config = { output: { publicPath: 'https://cdn.example.com/app/' } };
      expect(WebpackPathHandler.extractPublicPathFromConfig(config)).toBe('https://cdn.example.com/app/');
    });

    it('should handle auto publicPath', () => {
      const config = { output: { publicPath: 'auto' } };
      expect(WebpackPathHandler.extractPublicPathFromConfig(config)).toBe('./');
    });
  });
});

/**
 * Test suite for UrlConstructor
 */
describe('UrlConstructor', () => {
  describe('constructUrl', () => {
    it('should combine base and path', () => {
      expect(UrlConstructor.constructUrl('/app/', 'assets/image.png')).toBe('/app/assets/image.png');
      expect(UrlConstructor.constructUrl('./app/', 'assets/image.png')).toBe('./app/assets/image.png');
      expect(UrlConstructor.constructUrl('https://example.com/app/', 'assets/image.png')).toBe('https://example.com/app/assets/image.png');
    });

    it('should handle absolute paths', () => {
      expect(UrlConstructor.constructUrl('/app/', '/assets/image.png')).toBe('/assets/image.png');
      expect(UrlConstructor.constructUrl('./app/', '/assets/image.png')).toBe('/assets/image.png');
      expect(UrlConstructor.constructUrl('https://example.com/app/', '/assets/image.png')).toBe('/assets/image.png');
    });

    it('should handle URLs', () => {
      expect(UrlConstructor.constructUrl('/app/', 'https://cdn.example.com/assets/image.png')).toBe('https://cdn.example.com/assets/image.png');
      expect(UrlConstructor.constructUrl('./app/', 'https://cdn.example.com/assets/image.png')).toBe('https://cdn.example.com/assets/image.png');
      expect(UrlConstructor.constructUrl('https://example.com/app/', 'https://cdn.example.com/assets/image.png')).toBe('https://cdn.example.com/assets/image.png');
    });

    it('should handle empty path', () => {
      expect(UrlConstructor.constructUrl('/app/', '')).toBe('/app/');
      expect(UrlConstructor.constructUrl('./app/', '')).toBe('./app/');
      expect(UrlConstructor.constructUrl('https://example.com/app/', '')).toBe('https://example.com/app/');
    });

    it('should handle path with trailing slash', () => {
      expect(UrlConstructor.constructUrl('/app/', 'assets/')).toBe('/app/assets/');
      expect(UrlConstructor.constructUrl('./app/', 'assets/')).toBe('./app/assets/');
      expect(UrlConstructor.constructUrl('https://example.com/app/', 'assets/')).toBe('https://example.com/app/assets/');
    });

    it('should handle base without trailing slash', () => {
      expect(UrlConstructor.constructUrl('/app', 'assets/image.png')).toBe('/app/assets/image.png');
      expect(UrlConstructor.constructUrl('./app', 'assets/image.png')).toBe('./app/assets/image.png');
      expect(UrlConstructor.constructUrl('https://example.com/app', 'assets/image.png')).toBe('https://example.com/app/assets/image.png');
    });
  });
});

/**
 * Test suite for BaseHrefIntegration
 */
describe('BaseHrefIntegration', () => {
  describe('processViteConfig', () => {
    it('should apply base to Vite manifest', () => {
      const config = { base: '/app/' };
      const manifest = {};
      
      const result = BaseHrefIntegration.processViteConfig(config, manifest);
      
      expect(result.baseHref).toBe('/app/');
    });
    
    it('should construct URLs correctly with Vite base', () => {
      const config = { base: '/app/' };
      const manifest = {};
      
      const result = BaseHrefIntegration.processViteConfig(config, manifest);
      const url = BaseHrefIntegration.constructUrl(result, 'assets/image.png');
      
      expect(url).toBe('/app/assets/image.png');
    });
  });
  
  describe('processWebpackConfig', () => {
    it('should apply publicPath to Webpack manifest', () => {
      const config = { output: { publicPath: '/app/' } };
      const manifest = {};
      
      const result = BaseHrefIntegration.processWebpackConfig(config, manifest);
      
      expect(result.baseHref).toBe('/app/');
    });
    
    it('should construct URLs correctly with Webpack publicPath', () => {
      const config = { output: { publicPath: '/app/' } };
      const manifest = {};
      
      const result = BaseHrefIntegration.processWebpackConfig(config, manifest);
      const url = BaseHrefIntegration.constructUrl(result, 'assets/image.png');
      
      expect(url).toBe('/app/assets/image.png');
    });
  });
  
  describe('generateHtmlWithBase', () => {
    it('should generate HTML with correct base tag', () => {
      const baseHref = '/app/';
      const html = BaseHrefIntegration.generateHtmlWithBase('<html><head></head><body></body></html>', baseHref);
      
      expect(html).toContain('<base href="/app/">');
    });
    
    it('should not duplicate base tag', () => {
      const baseHref = '/app/';
      const html = BaseHrefIntegration.generateHtmlWithBase('<html><head><base href="/old/"></head><body></body></html>', baseHref);
      
      expect(html).toContain('<base href="/app/">');
      expect(html).not.toContain('<base href="/old/">');
    });
  });
});