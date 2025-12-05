import type { JsTransformOptions, JsTransformerConfig } from 'metro-transform-worker';
import { logFn } from 'zephyr-agent';
import './global';

interface ZephyrTransformerOptions {
  zephyr_engine?: any;
  zephyrOptions?: any;
  resolved_dependencies?: any[];
}

/** Metro transformer that injects Zephyr runtime capabilities */
export async function transform(
  config: JsTransformerConfig,
  projectRoot: string,
  filename: string,
  data: Buffer,
  options: JsTransformOptions & { zephyrOptions?: ZephyrTransformerOptions }
): Promise<{
  ast: any;
  code: string;
  map: any;
}> {
  // Use default Metro transformer first
  const upstream = require('metro-react-native-babel-transformer');
  const result = await upstream.transform(config, projectRoot, filename, data, options);

  // Only enhance entry files or files that import React Native
  const shouldEnhance = isZephyrTargetFile(filename, result.code);

  if (shouldEnhance && options.zephyrOptions) {
    const enhancedCode = injectZephyrRuntime(
      result.code,
      filename,
      options.zephyrOptions
    );

    return {
      ...result,
      code: enhancedCode,
    };
  }

  return result;
}

/** Check if file should be enhanced with Zephyr runtime */
function isZephyrTargetFile(filename: string, code: string): boolean {
  // Target main app entry points
  if (
    filename.includes('index.js') ||
    filename.includes('App.js') ||
    filename.includes('App.tsx')
  ) {
    return true;
  }

  // Target files that register the app
  if (
    code.includes('AppRegistry.registerComponent') ||
    code.includes('AppRegistry.runApplication')
  ) {
    return true;
  }

  // Target files that import Module Federation or remote components
  if (code.includes('loadRemote') || code.includes('__webpack_require__')) {
    return true;
  }

  return false;
}

/** Inject Zephyr runtime plugin capabilities */
function injectZephyrRuntime(
  originalCode: string,
  filename: string,
  options: ZephyrTransformerOptions
): string {
  try {
    const { zephyrOptions, resolved_dependencies } = options;

    // Create runtime plugin initialization code
    const runtimePluginCode = generateRuntimePluginCode(
      zephyrOptions,
      resolved_dependencies || []
    );

    // Inject at the top of the file
    const injectedCode = `
// === Zephyr Runtime Plugin Injection ===
${runtimePluginCode}
// === End Zephyr Injection ===

${originalCode}
`;

    logFn('info', `Injected Zephyr runtime into: ${filename}`);
    return injectedCode;
  } catch (error) {
    logFn('error', `Failed to inject Zephyr runtime into ${filename}: ${error}`);
    return originalCode; // Return original on error
  }
}

/** Generate runtime plugin initialization code */
function generateRuntimePluginCode(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _zephyrOptions: any,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _resolved_dependencies: any[]
): string {
  // Generate runtime initialization code using template strings
  // This is more robust than function stringification which can break with minification
  return `// Zephyr Runtime Plugin for React Native
(function() {
  if (typeof global !== 'undefined') {
    // Note: Modern React Native (0.60+) has fetch built-in, so no polyfill needed.
    // If fetch is not available, the runtime plugin will fail to initialize,
    // which is the correct behavior to alert developers of the missing dependency.

    // Import and initialize runtime plugin
    try {
      const { createZephyrRuntimePlugin } = require('zephyr-xpack-internal');

      const plugin = createZephyrRuntimePlugin({
        manifestUrl: '/zephyr-manifest.json',
      });

      // Store globally
      global.__ZEPHYR_RUNTIME_PLUGIN__ = plugin;

      console.log('[Zephyr] Runtime plugin initialized');
    } catch (error) {
      console.warn('[Zephyr] Failed to initialize runtime plugin:', error);
    }
  }
})();`;
}
