import { ZephyrEngine, normalizeBasePath } from 'zephyr-agent';

/**
 * Interface for options that might contain baseHref settings
 */
export interface BaseHrefOptions {
  baseHref?: string;
  publicPath?: string;
}

/**
 * Options that might be passed to HTML Webpack Plugin
 */
export interface HtmlPluginOptions {
  base?: string | { href?: string; target?: string };
}

/**
 * Interface for webpack/rspack compiler
 */
export interface WebpackLikeCompiler {
  options: {
    output?: {
      publicPath?: any; // Accept any type of publicPath (string, function, etc.)
    };
    plugins?: any[];
  };
  // Any other needed properties
}

/**
 * Extract baseHref from plugin options
 * 
 * @param options - Plugin options that might contain baseHref
 * @returns The baseHref value or undefined if not found
 */
function extractBaseHrefFromPluginOptions(options?: BaseHrefOptions): string | undefined {
  return options?.baseHref;
}

/**
 * Extract baseHref from HTML plugin options
 * 
 * @param plugins - Array of plugins
 * @returns The baseHref value or undefined if not found
 */
function extractBaseHrefFromHtmlPlugin(plugins: any[]): string | undefined {
  // Find HTML plugin
  const htmlPlugin = plugins.find(plugin => 
    plugin?.constructor?.name === 'HtmlWebpackPlugin' || 
    plugin?.constructor?.name === 'HtmlRspackPlugin'
  );

  if (!htmlPlugin || !htmlPlugin.options) {
    return undefined;
  }

  // Extract base from HTML plugin options
  const { base } = htmlPlugin.options as HtmlPluginOptions;
  
  if (typeof base === 'string') {
    return base;
  } else if (typeof base === 'object' && base?.href) {
    return base.href;
  }
  
  return undefined;
}

/**
 * Extract baseHref from output.publicPath
 * 
 * @param compiler - The webpack/rspack compiler object
 * @returns The publicPath value or undefined if not found
 */
function extractBaseHrefFromPublicPath(compiler: WebpackLikeCompiler): string | undefined {
  const publicPath = compiler.options.output?.publicPath;
  
  // Skip 'auto' value which is a special case in webpack
  if (publicPath === 'auto' || publicPath === undefined) {
    return undefined;
  }
  
  // Handle string publicPath directly
  if (typeof publicPath === 'string') {
    return publicPath;
  }
  
  // If publicPath is a function, we can't evaluate it here
  // Just log a warning and return undefined
  if (typeof publicPath === 'function') {
    console.warn('Warning: publicPath is a function, cannot extract baseHref automatically.');
    return undefined;
  }
  
  return undefined;
}

/**
 * Extracts baseHref from available sources with priority:
 * 1. Plugin options
 * 2. HTML Plugin
 * 3. Output.publicPath
 * 
 * @param zephyr_engine - ZephyrEngine instance
 * @param compiler - The webpack/rspack compiler object
 * @param pluginOptions - Options passed to the plugin
 */
export function detectAndStoreBaseHref(
  zephyr_engine: ZephyrEngine,
  compiler: WebpackLikeCompiler,
  pluginOptions?: BaseHrefOptions
): void {
  // Check for baseHref in plugin options (highest priority)
  let baseHref = extractBaseHrefFromPluginOptions(pluginOptions);
  
  // Check for baseHref in HTML plugin options (medium priority)
  if (!baseHref && compiler.options?.plugins) {
    baseHref = extractBaseHrefFromHtmlPlugin(compiler.options.plugins);
  }
  
  // Check for baseHref in output.publicPath (lowest priority)
  if (!baseHref) {
    baseHref = extractBaseHrefFromPublicPath(compiler);
  }
  
  // Store the baseHref in ZephyrEngine.buildProperties
  if (baseHref !== undefined) {
    zephyr_engine.buildProperties.baseHref = normalizeBasePath(baseHref);
  }
}