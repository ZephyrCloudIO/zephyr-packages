# BaseHref Implementation - Red Phase Tests

This document outlines the initial test cases for the BaseHref implementation, following our TDD approach. These tests are designed to fail initially (Red phase) and will guide our implementation.

## Test Cases

### 1. Basic Path Handling

```typescript
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
```

### 2. Vite Base Configuration

```typescript
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
```

### 3. Webpack PublicPath Handling

```typescript
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
```

### 4. URL Construction

```typescript
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
```

### 5. Runtime Base Path Detection

```typescript
describe('RuntimeBasePathDetector', () => {
  describe('detectBasePath', () => {
    beforeEach(() => {
      // Mock document.baseURI
      Object.defineProperty(document, 'baseURI', {
        value: 'https://example.com/app/',
        writable: true
      });
      
      // Mock script tags
      document.querySelectorAll = jest.fn().mockImplementation((selector) => {
        if (selector === 'script[src]') {
          return [
            { src: 'https://example.com/app/js/main.js' },
            { src: 'https://example.com/app/js/vendor.js' }
          ];
        }
        return [];
      });
    });

    it('should detect base path from document.baseURI', () => {
      expect(RuntimeBasePathDetector.detectBasePath()).toBe('/app/');
    });

    it('should detect base path from script tags if baseURI is unavailable', () => {
      // Remove baseURI
      Object.defineProperty(document, 'baseURI', {
        value: undefined,
        writable: true
      });
      
      expect(RuntimeBasePathDetector.detectBasePath()).toBe('/app/');
    });

    it('should fall back to default path if detection fails', () => {
      // Remove baseURI and script tags
      Object.defineProperty(document, 'baseURI', {
        value: undefined,
        writable: true
      });
      
      document.querySelectorAll = jest.fn().mockImplementation(() => []);
      
      expect(RuntimeBasePathDetector.detectBasePath()).toBe('./');
    });

    it('should extract base path from full URL', () => {
      // Set baseURI to full URL
      Object.defineProperty(document, 'baseURI', {
        value: 'https://example.com/app/index.html',
        writable: true
      });
      
      expect(RuntimeBasePathDetector.detectBasePath()).toBe('/app/');
    });
  });
});
```

### 6. Integration Tests

```typescript
describe('BaseHrefIntegration', () => {
  describe('Vite integration', () => {
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
  
  describe('Webpack integration', () => {
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
  
  describe('HTML generation', () => {
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
```

## Next Steps

1. Create the necessary module structure and empty classes/functions to match these tests
2. Run the tests to verify they fail (Red phase)
3. Implement the functionality to make the tests pass (Green phase)
4. Refactor the code while keeping the tests passing

## Implementation Approach

Based on these tests, we'll need to create:

1. `BasePathHandler` - Core utility for path normalization and detection
2. `ViteBaseHandler` - Specific handling for Vite's base configuration
3. `WebpackPathHandler` - Handling for Webpack/Rspack's publicPath
4. `UrlConstructor` - Utilities for combining base and paths
5. `RuntimeBasePathDetector` - Client-side detection of base paths
6. `BaseHrefIntegration` - Integration layer for the full functionality

The implementation will follow our TDD approach, starting with making these tests pass one by one.