import type { JsTransformOptions, JsTransformerConfig } from 'metro-transform-worker';
import { ze_log } from 'zephyr-agent';
// Note: Global type declarations are in ./global.d.ts (ambient, no runtime import needed)

interface ZephyrTransformerOptions {
  /** Custom manifest endpoint path */
  manifestPath?: string;
  /** Custom entry file patterns for more conservative targeting */
  entryFiles?: string[];
}

/** Default entry file patterns if none specified */
const DEFAULT_ENTRY_FILES = ['index.js', 'index.ts', 'index.tsx', 'App.js', 'App.tsx'];

/** Metro transformer that injects Zephyr runtime capabilities */
export async function transform(
  config: JsTransformerConfig & { zephyrTransformerOptions?: ZephyrTransformerOptions },
  projectRoot: string,
  filename: string,
  data: Buffer,
  options: JsTransformOptions
): Promise<{
  ast: any;
  code: string;
  map: any;
}> {
  // Use default Metro transformer first
  const upstream = require('metro-react-native-babel-transformer');
  const result = await upstream.transform(config, projectRoot, filename, data, options);

  // Get Zephyr transformer options from config
  const zephyrOptions = config.zephyrTransformerOptions;
  const entryFiles = zephyrOptions?.entryFiles || DEFAULT_ENTRY_FILES;

  // Only enhance entry files - use configurable patterns for more conservative targeting
  const shouldEnhance = isZephyrTargetFile(filename, result.code, entryFiles);

  if (shouldEnhance) {
    const manifestPath = zephyrOptions?.manifestPath || '/zephyr-manifest.json';
    const enhancedCode = injectZephyrRuntime(result.code, filename, manifestPath);

    return {
      ...result,
      code: enhancedCode,
    };
  }

  return result;
}

/** Check if file should be enhanced with Zephyr runtime */
function isZephyrTargetFile(
  filename: string,
  code: string,
  entryFiles: string[]
): boolean {
  // Check against configured entry file patterns
  const isEntryFile = entryFiles.some((pattern) => {
    // Support glob-like patterns (simple matching)
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filename);
    }
    return filename.endsWith(pattern) || filename.includes(`/${pattern}`);
  });

  if (isEntryFile) {
    return true;
  }

  // Target files that register the app (React Native entry point detection)
  if (
    code.includes('AppRegistry.registerComponent') ||
    code.includes('AppRegistry.runApplication')
  ) {
    return true;
  }

  return false;
}

/** Inject Zephyr runtime plugin capabilities */
function injectZephyrRuntime(
  originalCode: string,
  filename: string,
  manifestPath: string
): string {
  try {
    // Create runtime plugin initialization code
    const runtimePluginCode = generateRuntimePluginCode(manifestPath);

    // Inject at the top of the file
    const injectedCode = `
// === Zephyr Runtime Plugin Injection ===
${runtimePluginCode}
// === End Zephyr Injection ===

${originalCode}
`;

    ze_log.misc(`Injected Zephyr runtime into: ${filename}`);
    return injectedCode;
  } catch (error) {
    ze_log.error(`Failed to inject Zephyr runtime into ${filename}: ${error}`);
    return originalCode; // Return original on error
  }
}

/** Generate runtime plugin initialization code */
function generateRuntimePluginCode(manifestPath: string): string {
  // Generate runtime initialization code using template strings
  // This is more robust than function stringification which can break with minification
  return `// Zephyr Runtime Plugin for React Native
(function() {
  if (typeof global !== 'undefined' && !global.__ZEPHYR_RUNTIME_PLUGIN__) {
    // Prevent multiple initializations
    try {
      var createZephyrRuntimePlugin = require('zephyr-xpack-internal').createZephyrRuntimePlugin;

      var plugin = createZephyrRuntimePlugin({
        manifestUrl: '${manifestPath}',
      });

      // Store globally
      global.__ZEPHYR_RUNTIME_PLUGIN__ = plugin;

      if (__DEV__) {
        console.log('[Zephyr] Runtime plugin initialized');
      }
    } catch (error) {
      // zephyr-xpack-internal is an optional peer dependency
      if (__DEV__) {
        console.warn('[Zephyr] Runtime plugin not available:', error.message);
      }
    }
  }
})();`;
}
