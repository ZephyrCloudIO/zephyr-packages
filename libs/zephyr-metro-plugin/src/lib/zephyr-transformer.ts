import type { JsTransformOptions, JsTransformerConfig } from 'metro-transform-worker';
import { ze_log } from 'zephyr-agent';
// Note: Global type declarations are in ./global.d.ts (ambient, no runtime import needed)

interface ZephyrTransformerOptions {
  /** Custom manifest endpoint path */
  manifestPath?: string;
  /** Custom entry file patterns for more conservative targeting */
  entryFiles?: string[];
  /** Enable OTA updates */
  enableOTA?: boolean;
  /** Application UID for OTA */
  applicationUid?: string;
  /** OTA configuration */
  otaConfig?: {
    checkInterval?: number;
    debug?: boolean;
  };
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
    const enhancedCode = injectZephyrRuntime(
      result.code,
      filename,
      manifestPath,
      zephyrOptions
    );

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

/** Inject Zephyr runtime plugin and OTA capabilities */
function injectZephyrRuntime(
  originalCode: string,
  filename: string,
  manifestPath: string,
  zephyrOptions?: ZephyrTransformerOptions
): string {
  try {
    // Create runtime plugin initialization code
    const runtimePluginCode = generateRuntimePluginCode(manifestPath, zephyrOptions);

    // Create OTA initialization code if enabled
    const otaCode = zephyrOptions?.enableOTA ? generateOTACode(zephyrOptions) : '';

    // Inject at the top of the file
    const injectedCode = `
// === Zephyr Runtime Plugin Injection ===
${runtimePluginCode}
${otaCode}
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
function generateRuntimePluginCode(
  manifestPath: string,
  zephyrOptions?: ZephyrTransformerOptions
): string {
  // Generate runtime initialization code using template strings
  // This is more robust than function stringification which can break with minification

  // Determine which plugin creator to use based on OTA setting
  const usesMobilePlugin = zephyrOptions?.enableOTA;

  if (usesMobilePlugin) {
    return `// Zephyr Runtime Plugin for React Native (with OTA support)
(function() {
  if (typeof global !== 'undefined' && !global.__ZEPHYR_RUNTIME_PLUGIN__) {
    // Prevent multiple initializations
    try {
      var createZephyrRuntimePluginMobile = require('zephyr-xpack-internal').createZephyrRuntimePluginMobile;

      var result = createZephyrRuntimePluginMobile({
        manifestUrl: '${manifestPath}',
        onManifestChange: function(newManifest, oldManifest) {
          console.log('[Zephyr] Manifest updated:', newManifest.version);
          if (global.__ZEPHYR_MANIFEST_CHANGED__) {
            global.__ZEPHYR_MANIFEST_CHANGED__(newManifest, oldManifest);
          }
        },
        onManifestError: function(error) {
          console.warn('[Zephyr] Manifest error:', error);
        },
      });

      // Store globally for OTA worker access
      global.__ZEPHYR_RUNTIME_PLUGIN__ = result.plugin;
      global.__ZEPHYR_RUNTIME_PLUGIN_INSTANCE__ = result.instance;

      if (__DEV__) {
        console.log('[Zephyr] Runtime plugin initialized (mobile)');
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

  return `// Zephyr Runtime Plugin for React Native
(function() {
  if (typeof global !== 'undefined' && !global.__ZEPHYR_RUNTIME_PLUGIN__) {
    // Prevent multiple initializations
    try {
      var createZephyrRuntimePlugin = require('zephyr-xpack-internal').createZephyrRuntimePlugin;

      var plugin = createZephyrRuntimePlugin({
        manifestUrl: '${manifestPath}',
      });

      // Store globally for OTA worker access
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

/**
 * Generate OTA worker initialization code Uses function stringification to maintain type
 * safety
 */
function generateOTACode(zephyrOptions: ZephyrTransformerOptions): string {
  if (!zephyrOptions.enableOTA) return '';

  const otaConfig = zephyrOptions.otaConfig || {};
  const appUid = zephyrOptions.applicationUid || 'unknown';
  const checkInterval = otaConfig.checkInterval || 30 * 60 * 1000;
  const debug = Boolean(otaConfig.debug);

  // Generate OTA initialization code using template strings
  // This is more robust than function stringification which can break with minification
  return `// Zephyr OTA Initialization - React Native Compatible
(function() {
  const globalObj = (function() {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof global !== 'undefined') return global;
    if (typeof window !== 'undefined') return window;
    return {};
  })();

  if (globalObj.__ZEPHYR_RUNTIME_PLUGIN_INSTANCE__) {
    try {
      // Check if ZephyrOTAWorker is available (must be imported by user)
      const ZephyrOTAWorker = globalObj.__ZEPHYR_OTA_WORKER_CLASS__;

      if (!ZephyrOTAWorker) {
        console.warn('[Zephyr OTA] ZephyrOTAWorker not found. Make sure to import it in your app.');
        return;
      }

      const otaWorker = new ZephyrOTAWorker(
        {
          applicationUid: '${appUid}',
          checkInterval: ${checkInterval},
          debug: ${debug},
          enableOTA: true,
        },
        {
          onUpdateAvailable: function(update) {
            console.log('[Zephyr OTA] Update available:', update.version);
            if (globalObj.__ZEPHYR_OTA_UPDATE_AVAILABLE__) {
              globalObj.__ZEPHYR_OTA_UPDATE_AVAILABLE__(update);
            }
          },
          onUpdateError: function(error) {
            console.warn('[Zephyr OTA] Update check error:', error);
          },
          onUpdateApplied: function(version) {
            console.log('[Zephyr OTA] Update applied:', version);
            // In standard RN, this likely means restart is needed
            if (globalObj.__ZEPHYR_OTA_RESTART_REQUIRED__) {
              globalObj.__ZEPHYR_OTA_RESTART_REQUIRED__({ version: version });
            }
          },
        }
      );

      // Connect to runtime plugin
      otaWorker.setRuntimePlugin(globalObj.__ZEPHYR_RUNTIME_PLUGIN_INSTANCE__);

      // Store globally and auto-start
      globalObj.__ZEPHYR_OTA_WORKER__ = otaWorker;

      // Check environment capability before starting
      if (globalObj.__ZEPHYR_BUNDLE_MANAGER__) {
        const envInfo = globalObj.__ZEPHYR_BUNDLE_MANAGER__.getEnvironmentInfo();
        console.log('[Zephyr OTA] Environment:', envInfo);
      }

      otaWorker.start();
      console.log('[Zephyr OTA] Worker initialized for environment');
    } catch (error) {
      console.warn('[Zephyr OTA] Failed to initialize OTA worker:', error);
    }
  }
})();`;
}
