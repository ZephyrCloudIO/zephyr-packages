# BaseHref Implementation Documentation

## Overview

The BaseHref implementation provides a consistent way to handle application paths across different bundlers and deployment scenarios. This is particularly important for applications deployed to non-root paths or using CDNs.

## Key Features

1. **Path Normalization**: Consistent handling of paths across different formats
2. **Bundler Integration**: Support for Vite, Webpack, and Rspack configurations
3. **URL Construction**: Intelligent URL building with base path consideration
4. **Runtime Detection**: Client-side detection of base paths
5. **HTML Generation**: Proper HTML base tag handling

## Core Components

### BasePathHandler

The `BasePathHandler` is the core utility for path normalization and detection. It provides static methods for handling different path formats.

```typescript
import { BasePathHandler } from './basehref-implementation';

// Normalize paths consistently
const normalizedPath = BasePathHandler.normalizePath('/app');  // '/app/'
const normalizedRelative = BasePathHandler.normalizePath('assets');  // './assets/'

// Check path types
const isAbsolute = BasePathHandler.isAbsolutePath('/app/');  // true
const isUrl = BasePathHandler.isUrl('https://example.com/app/');  // true
```

### Bundler-Specific Handlers

#### ViteBaseHandler

Handles Vite's `base` configuration option.

```typescript
import { ViteBaseHandler } from './basehref-implementation';

// Extract base from Vite config
const viteConfig = { base: '/app' };
const base = ViteBaseHandler.extractBaseFromConfig(viteConfig);  // '/app/'

// Apply to manifest
const manifest = {};
const updatedManifest = ViteBaseHandler.applyBaseToManifest(manifest, base);
// { baseHref: '/app/' }
```

#### WebpackPathHandler

Handles Webpack/Rspack's `output.publicPath` configuration.

```typescript
import { WebpackPathHandler } from './basehref-implementation';

// Extract publicPath from Webpack config
const webpackConfig = { output: { publicPath: '/app' } };
const publicPath = WebpackPathHandler.extractPublicPathFromConfig(webpackConfig);  // '/app/'
```

### URL Construction

The `UrlConstructor` provides utilities for combining base paths with relative paths.

```typescript
import { UrlConstructor } from './basehref-implementation';

// Construct URLs with base path
const url = UrlConstructor.constructUrl('/app/', 'assets/image.png');  // '/app/assets/image.png'

// Absolute paths and URLs are preserved
const absoluteUrl = UrlConstructor.constructUrl('/app/', '/assets/image.png');  // '/assets/image.png'
const externalUrl = UrlConstructor.constructUrl('/app/', 'https://cdn.example.com/image.png');  // 'https://cdn.example.com/image.png'
```

### Runtime Detection

The `RuntimeBasePathDetector` provides client-side detection of base paths.

```typescript
import { RuntimeBasePathDetector } from './basehref-implementation';

// Detect base path at runtime
const basePath = RuntimeBasePathDetector.detectBasePath();  // e.g., '/app/'
```

### Integration Layer

The `BaseHrefIntegration` provides a high-level integration API for common tasks.

```typescript
import { BaseHrefIntegration } from './basehref-implementation';

// Process Vite config
const viteConfig = { base: '/app/' };
const manifest = {};
const viteManifest = BaseHrefIntegration.processViteConfig(viteConfig, manifest);  // { baseHref: '/app/' }

// Process Webpack config
const webpackConfig = { output: { publicPath: '/app/' } };
const webpackManifest = BaseHrefIntegration.processWebpackConfig(webpackConfig, manifest);  // { baseHref: '/app/' }

// Construct URL with manifest
const url = BaseHrefIntegration.constructUrl(viteManifest, 'assets/image.png');  // '/app/assets/image.png'

// Generate HTML with base tag
const html = '<html><head></head><body></body></html>';
const htmlWithBase = BaseHrefIntegration.generateHtmlWithBase(html, '/app/');
// '<html><head>
//   <base href="/app/">
// </head><body></body></html>'
```

## Usage Examples

### Vite Integration

```typescript
import { defineConfig } from 'vite';
import { BaseHrefIntegration } from './basehref-implementation';

export default defineConfig({
  base: '/app/',
  plugins: [
    {
      name: 'vite-base-href',
      configResolved(config) {
        // Extract base from Vite config
        const manifest = {};
        const updatedManifest = BaseHrefIntegration.processViteConfig(config, manifest);
        
        // Use updatedManifest.baseHref in your plugin
        console.log(`Base path: ${updatedManifest.baseHref}`);
      },
      transformIndexHtml(html) {
        // Add base tag to HTML
        return BaseHrefIntegration.generateHtmlWithBase(html, '/app/');
      }
    }
  ]
});
```

### Webpack/Rspack Integration

```typescript
const { BaseHrefIntegration } = require('./basehref-implementation');

module.exports = {
  output: {
    publicPath: '/app/'
  },
  plugins: [
    {
      apply(compiler) {
        compiler.hooks.afterEmit.tap('WebpackBaseHref', compilation => {
          // Extract publicPath from Webpack config
          const manifest = {};
          const updatedManifest = BaseHrefIntegration.processWebpackConfig(compiler.options, manifest);
          
          // Use updatedManifest.baseHref in your plugin
          console.log(`Public path: ${updatedManifest.baseHref}`);
        });
      }
    },
    new HtmlWebpackPlugin({
      template: 'src/index.html',
      templateParameters: {
        baseHref: '/app/'
      }
    })
  ]
};
```

## Best Practices

1. **Always normalize paths** before using them to ensure consistent behavior
2. **Respect absolute paths and URLs** to prevent unnecessary modifications
3. **Use RuntimeBasePathDetector** when dynamic detection is needed at runtime
4. **Add a base tag to HTML** for proper path resolution in the browser
5. **Test with various deployment scenarios**, including subdirectories and CDNs

## Edge Cases and Considerations

1. **Empty Paths**: Handled consistently with default values
2. **Double Slashes**: Prevented by normalization functions
3. **Auto PublicPath**: Special handling for Webpack 5+ 'auto' value
4. **Runtime Detection Fallbacks**: Multiple strategies with graceful degradation
5. **HTML with Existing Base**: Properly updates without duplicating tags

## Performance Considerations

1. **Path normalization and URL construction** are optimized for minimal overhead
2. **RuntimeBasePathDetector** uses caching to prevent repeated detections
3. **All utility classes** have static methods to avoid instance creation costs

## Conclusion

The BaseHref implementation provides a comprehensive solution for handling application paths across different bundlers and deployment scenarios. It ensures consistent behavior and proper path resolution, making it easier to deploy applications to various environments.