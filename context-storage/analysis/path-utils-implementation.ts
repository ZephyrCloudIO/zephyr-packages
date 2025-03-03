/**
 * PathUtils - Core utility for path handling and URL operations
 * 
 * This abstraction centralizes all path-related functionality in one place
 * to eliminate duplication between different bundler implementations.
 */

/**
 * Interface for URL components
 */
export interface UrlComponents {
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
}

/**
 * Options for path construction
 */
export interface PathOptions {
  trailingSlash?: boolean;
  leadingDot?: boolean;
}

/**
 * PathUtils - Shared utilities for path handling and URL operations
 */
export class PathUtils {
  /**
   * URL pattern for detecting URLs
   * @private
   */
  private static readonly URL_PATTERN = /^(https?:)?\/\//;

  /**
   * Absolute path pattern
   * @private
   */
  private static readonly ABSOLUTE_PATH_PATTERN = /^\//;

  /**
   * Normalizes a path to ensure consistency
   * - Can add trailing slash if requested
   * - Can add leading ./ for relative paths if requested
   * - Preserves protocol for URLs
   * 
   * @param path The path to normalize
   * @param options Normalization options
   */
  static normalizePath(path: string, options: PathOptions = { trailingSlash: true, leadingDot: true }): string {
    if (!path) {
      return options.leadingDot ? './' : (path === '' ? '' : '/');
    }

    // Preserve URLs
    if (this.isUrl(path)) {
      return options.trailingSlash && !path.endsWith('/') ? `${path}/` : path;
    }

    // Handle absolute paths
    if (this.isAbsolutePath(path)) {
      return options.trailingSlash && !path.endsWith('/') ? `${path}/` : path;
    }

    // Handle relative paths
    let normalizedPath = path;
    if (options.leadingDot && !path.startsWith('./') && !path.startsWith('../')) {
      normalizedPath = `./${path}`;
    }

    return options.trailingSlash && !normalizedPath.endsWith('/') ? `${normalizedPath}/` : normalizedPath;
  }

  /**
   * Checks if a path is absolute
   * Absolute paths start with / or are URLs
   * 
   * @param path The path to check
   */
  static isAbsolutePath(path: string): boolean {
    if (!path) return false;
    return this.ABSOLUTE_PATH_PATTERN.test(path) || this.isUrl(path);
  }

  /**
   * Checks if a path is a URL
   * URLs start with http://, https://, or //
   * 
   * @param path The path to check
   */
  static isUrl(path: string): boolean {
    if (!path) return false;
    return this.URL_PATTERN.test(path);
  }

  /**
   * Constructs a URL by combining base and path
   * - Respects absolute paths (will not prepend base)
   * - Respects URLs (will not modify)
   * - Ensures trailing slash in base
   * - Ensures no duplicate slashes
   * 
   * @param base The base path or URL
   * @param path The path to append
   */
  static constructUrl(base: string, path: string): string {
    // Handle empty path case
    if (!path) {
      return this.normalizePath(base);
    }
    
    // If path is absolute or a URL, return it as is
    if (this.isAbsolutePath(path)) {
      return path;
    }
    
    // Normalize base to ensure trailing slash
    const normalizedBase = this.normalizePath(base);
    
    // Remove leading ./ from path if present
    const normalizedPath = path.startsWith('./') ? path.substring(2) : path;
    
    // Combine base and path, ensuring no double slashes
    return `${normalizedBase}${normalizedPath}`;
  }

  /**
   * Extracts base path from a full URL
   * Removes protocol, host, and filename
   * 
   * @param url The URL to extract base path from
   */
  static extractBasePathFromUrl(url: string): string {
    try {
      const urlObj = new URL(url, 'http://example.com');
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

  /**
   * Parses a URL into its components
   * 
   * @param url The URL to parse
   */
  static parseUrl(url: string): UrlComponents {
    try {
      const urlObj = new URL(url, 'http://example.com');
      return {
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port,
        pathname: urlObj.pathname,
        search: urlObj.search,
        hash: urlObj.hash
      };
    } catch (error) {
      console.warn('Failed to parse URL:', error);
      return {
        protocol: '',
        hostname: '',
        port: '',
        pathname: '',
        search: '',
        hash: ''
      };
    }
  }

  /**
   * Join path segments with proper handling of slashes
   * 
   * @param segments Path segments to join
   */
  static joinPath(...segments: string[]): string {
    if (segments.length === 0) return '';
    
    return segments.reduce((result, segment) => {
      if (!segment) return result;
      
      // Handle first segment specially
      if (result === '') {
        return segment;
      }
      
      // Ensure single slash between segments
      const hasTrailingSlash = result.endsWith('/');
      const hasLeadingSlash = segment.startsWith('/');
      
      if (hasTrailingSlash && hasLeadingSlash) {
        return result + segment.substring(1);
      } else if (!hasTrailingSlash && !hasLeadingSlash) {
        return `${result}/${segment}`;
      } else {
        return result + segment;
      }
    }, '');
  }

  /**
   * Convert a file system path to a URL path
   * 
   * @param filePath The file system path
   */
  static toUrlPath(filePath: string): string {
    // Replace backslashes with forward slashes
    let urlPath = filePath.replace(/\\/g, '/');
    
    // Ensure leading slash
    if (!urlPath.startsWith('/')) {
      urlPath = `/${urlPath}`;
    }
    
    return urlPath;
  }

  /**
   * Convert a URL path to a file system path
   * 
   * @param urlPath The URL path
   */
  static toFilePath(urlPath: string): string {
    // On Windows, convert to backslashes
    if (process.platform === 'win32') {
      return urlPath.replace(/^\//, '').replace(/\//g, '\\');
    }
    
    // On other platforms, just ensure no leading slash for relative paths
    return urlPath.startsWith('/') ? urlPath : urlPath.replace(/^\//, '');
  }

  /**
   * Get the parent directory path
   * 
   * @param path The path to get parent of
   */
  static getParentPath(path: string): string {
    const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    
    if (lastSlashIndex < 0) {
      return '';
    }
    
    return normalizedPath.substring(0, lastSlashIndex + 1);
  }

  /**
   * Get the file name from a path
   * 
   * @param path The path to extract filename from
   */
  static getFileName(path: string): string {
    const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    
    if (lastSlashIndex < 0) {
      return normalizedPath;
    }
    
    return normalizedPath.substring(lastSlashIndex + 1);
  }

  /**
   * Resolves a path against a base path
   * 
   * @param basePath The base path to resolve against
   * @param path The path to resolve
   */
  static resolvePath(basePath: string, path: string): string {
    // If path is absolute or URL, return it as is
    if (this.isAbsolutePath(path) || this.isUrl(path)) {
      return path;
    }
    
    // Handle ../ in paths
    const baseSegments = basePath.split('/').filter(Boolean);
    const pathSegments = path.split('/').filter(Boolean);
    
    const resultSegments = [...baseSegments];
    
    for (const segment of pathSegments) {
      if (segment === '..') {
        resultSegments.pop();
      } else if (segment !== '.') {
        resultSegments.push(segment);
      }
    }
    
    return this.joinPath(...resultSegments);
  }
}