/**
 * BaseHref Implementation - Skeleton
 * 
 * This file contains the skeleton implementation for the BaseHref functionality.
 * Following TDD approach, this contains just enough structure to make the tests compile,
 * but the implementation is minimal to ensure tests fail initially.
 */

/**
 * BasePathHandler - Core utility for path normalization and detection
 */
export class BasePathHandler {
  /**
   * URL pattern for detecting URLs
   * @private
   */
  private static URL_PATTERN = /^(https?:)?\/\//;

  /**
   * Normalizes a path to ensure consistency
   * - Adds trailing slash if missing
   * - Adds leading ./ for relative paths
   * - Preserves protocol for URLs
   */
  static normalizePath(path: string): string {
    if (!path) {
      return path === '' ? './' : '/';
    }

    // Preserve URLs
    if (this.isUrl(path)) {
      return path.endsWith('/') ? path : `${path}/`;
    }

    // Handle absolute paths
    if (path.startsWith('/')) {
      return path.endsWith('/') ? path : `${path}/`;
    }

    // Handle relative paths
    if (!path.startsWith('./') && !path.startsWith('../')) {
      path = `./${path}`;
    }

    return path.endsWith('/') ? path : `${path}/`;
  }

  /**
   * Checks if a path is absolute
   * Absolute paths start with / or are URLs
   */
  static isAbsolutePath(path: string): boolean {
    if (!path) return false;
    return path.startsWith('/') || this.isUrl(path);
  }

  /**
   * Checks if a path is a URL
   * URLs start with http://, https://, or //
   */
  static isUrl(path: string): boolean {
    if (!path) return false;
    return this.URL_PATTERN.test(path);
  }
}

/**
 * ViteBaseHandler - Specific handling for Vite's base configuration
 */
export class ViteBaseHandler {
  /**
   * Extracts base path from Vite configuration
   * Handles the 'base' option in Vite config
   * Default is './' when not specified
   */
  static extractBaseFromConfig(config: any): string {
    if (!config || typeof config !== 'object') {
      return './';
    }

    const base = config.base;
    
    if (base === undefined || base === null || base === '') {
      return './';
    }

    return BasePathHandler.normalizePath(base);
  }

  /**
   * Applies base path to manifest
   * Creates a new manifest object with baseHref field
   */
  static applyBaseToManifest(manifest: any, base: string): any {
    if (!manifest || typeof manifest !== 'object') {
      manifest = {};
    }
    
    return {
      ...manifest,
      baseHref: base
    };
  }
}

/**
 * WebpackPathHandler - Handling for Webpack/Rspack's publicPath
 */
export class WebpackPathHandler {
  /**
   * Extracts public path from Webpack configuration
   * Handles the 'output.publicPath' option in Webpack/Rspack config
   * Default is './' when not specified or set to 'auto'
   */
  static extractPublicPathFromConfig(config: any): string {
    if (!config || typeof config !== 'object') {
      return './';
    }

    const output = config.output;
    if (!output || typeof output !== 'object') {
      return './';
    }

    const publicPath = output.publicPath;
    
    // Handle special case 'auto' in Webpack 5+
    if (publicPath === 'auto' || publicPath === undefined || publicPath === null || publicPath === '') {
      return './';
    }

    return BasePathHandler.normalizePath(publicPath);
  }
}

/**
 * UrlConstructor - Utilities for combining base and paths
 */
export class UrlConstructor {
  /**
   * Constructs a URL by combining base and path
   * - Respects absolute paths (will not prepend base)
   * - Respects URLs (will not modify)
   * - Ensures trailing slash in base
   * - Ensures no duplicate slashes
   */
  static constructUrl(base: string, path: string): string {
    // Handle empty path case
    if (!path) {
      return BasePathHandler.normalizePath(base);
    }
    
    // If path is absolute or a URL, return it as is
    if (BasePathHandler.isAbsolutePath(path)) {
      return path;
    }
    
    // Normalize base to ensure trailing slash
    const normalizedBase = BasePathHandler.normalizePath(base);
    
    // Remove leading ./ from path if present
    const normalizedPath = path.startsWith('./') ? path.substring(2) : path;
    
    // Combine base and path, ensuring no double slashes
    return `${normalizedBase}${normalizedPath}`;
  }
}

/**
 * RuntimeBasePathDetector - Client-side detection of base paths
 */
export class RuntimeBasePathDetector {
  /**
   * Detects base path from the current environment
   * Uses multiple strategies to determine the base path:
   * 1. document.baseURI if available
   * 2. Script tag src paths as fallback
   * 3. Default to './' if detection fails
   */
  static detectBasePath(): string {
    // Browser environment check
    if (typeof document === 'undefined') {
      return './';
    }

    // Try to get base from document.baseURI
    if (document.baseURI) {
      return this.extractBasePathFromUrl(document.baseURI);
    }

    // Fall back to script tag detection
    try {
      const scriptTags = document.querySelectorAll('script[src]');
      if (scriptTags.length > 0) {
        // Get the first script with a src attribute
        const scriptSrc = (scriptTags[0] as HTMLScriptElement).src;
        if (scriptSrc) {
          return this.extractBasePathFromUrl(scriptSrc);
        }
      }
    } catch (error) {
      console.warn('Failed to detect base path from script tags:', error);
    }

    // Default fallback
    return './';
  }

  /**
   * Extracts base path from a full URL
   * Removes protocol, host, and filename
   * @private
   */
  private static extractBasePathFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // If pathname ends with a file (contains a dot after the last slash)
      const lastSlashIndex = pathname.lastIndexOf('/');
      const hasFileExtension = pathname.indexOf('.', lastSlashIndex) > lastSlashIndex;
      
      // If it's a file path, get the directory
      let basePath = hasFileExtension 
        ? pathname.substring(0, lastSlashIndex + 1) 
        : pathname;
      
      // Ensure trailing slash
      if (!basePath.endsWith('/')) {
        basePath += '/';
      }
      
      return basePath;
    } catch (error) {
      console.warn('Failed to parse URL:', error);
      return './';
    }
  }
}

/**
 * BaseHrefIntegration - Integration layer for the full functionality
 */
export class BaseHrefIntegration {
  /**
   * Processes Vite configuration and applies base to manifest
   * Extracts base from Vite config and adds it to the manifest
   */
  static processViteConfig(config: any, manifest: any): any {
    const base = ViteBaseHandler.extractBaseFromConfig(config);
    return ViteBaseHandler.applyBaseToManifest(manifest, base);
  }

  /**
   * Processes Webpack configuration and applies public path to manifest
   * Extracts publicPath from Webpack config and adds it to the manifest
   */
  static processWebpackConfig(config: any, manifest: any): any {
    const publicPath = WebpackPathHandler.extractPublicPathFromConfig(config);
    return ViteBaseHandler.applyBaseToManifest(manifest, publicPath);
  }

  /**
   * Constructs a URL using manifest's baseHref
   * Uses the baseHref field from manifest to construct a URL
   */
  static constructUrl(manifest: any, path: string): string {
    if (!manifest || typeof manifest !== 'object' || !manifest.baseHref) {
      return path;
    }

    return UrlConstructor.constructUrl(manifest.baseHref, path);
  }

  /**
   * Generates HTML with base tag
   * Adds or updates the <base> tag in the HTML head
   */
  static generateHtmlWithBase(html: string, baseHref: string): string {
    if (!html || typeof html !== 'string') {
      return html;
    }

    // Create a base tag with the provided href
    const baseTag = `<base href="${baseHref}">`;

    // Check if there's an existing base tag
    const hasBaseTag = /<base[^>]*>/i.test(html);

    if (hasBaseTag) {
      // Replace existing base tag
      return html.replace(/<base[^>]*>/i, baseTag);
    } else {
      // Add base tag after head opening
      return html.replace(/<head[^>]*>/i, `$&\n  ${baseTag}`);
    }
  }
}