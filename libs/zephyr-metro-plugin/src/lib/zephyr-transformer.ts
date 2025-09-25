import type { JsTransformOptions, JsTransformerConfig } from 'metro-transform-worker';
import { logFn } from 'zephyr-agent';
import path from 'path';

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

/** Inject Zephyr runtime plugin and OTA capabilities */
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
      resolved_dependencies
    );

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

    logFn('info', `Injected Zephyr runtime into: ${filename}`);
    return injectedCode;
  } catch (error) {
    logFn('error', `Failed to inject Zephyr runtime into ${filename}: ${error}`);
    return originalCode; // Return original on error
  }
}

/** Generate runtime plugin initialization code */
function generateRuntimePluginCode(
  zephyrOptions: any,
  resolved_dependencies: any[]
): string {
  const manifestData = resolved_dependencies
    ? JSON.stringify(
        {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          dependencies: resolved_dependencies.reduce((acc, dep) => {
            acc[dep.name] = {
              name: dep.name,
              application_uid: dep.application_uid,
              remote_entry_url: dep.remote_entry_url,
              default_url: dep.default_url,
              library_type: dep.library_type || 'var',
            };
            return acc;
          }, {}),
        },
        null,
        2
      )
    : '{}';

  return `
// Zephyr Runtime Plugin for React Native
(function() {
  if (typeof global !== 'undefined') {
    // Mock fetch for manifest if not available
    if (!global.fetch) {
      global.fetch = function(url) {
        if (url === '/zephyr-manifest.json' || url.endsWith('/zephyr-manifest.json')) {
          return Promise.resolve({
            ok: true,
            json: function() {
              return Promise.resolve(${manifestData});
            }
          });
        }
        return Promise.reject(new Error('Fetch not available in React Native'));
      };
    }

    // Import and initialize runtime plugin
    try {
      const { createZephyrRuntimePluginWithOTA } = require('zephyr-xpack-internal/src/xpack-extract/runtime-plugin');

      const { plugin, instance } = createZephyrRuntimePluginWithOTA({
        manifestUrl: '/zephyr-manifest.json',
        onManifestChange: function(newManifest, oldManifest) {
          console.log('[Zephyr] Manifest updated:', newManifest.version);
          global.__ZEPHYR_MANIFEST_CHANGED__ && global.__ZEPHYR_MANIFEST_CHANGED__(newManifest, oldManifest);
        },
        onManifestError: function(error) {
          console.warn('[Zephyr] Manifest error:', error);
        }
      });

      // Store globally for OTA worker access
      global.__ZEPHYR_RUNTIME_PLUGIN__ = plugin;
      global.__ZEPHYR_RUNTIME_PLUGIN_INSTANCE__ = instance;

      console.log('[Zephyr] Runtime plugin initialized');
    } catch (error) {
      console.warn('[Zephyr] Failed to initialize runtime plugin:', error);
    }
  }
})();
`;
}

/**
 * Generate OTA worker initialization code FIXED: Avoid require() calls that won't resolve
 * in RN bundles
 */
function generateOTACode(zephyrOptions: any): string {
  if (!zephyrOptions.enableOTA) return '';

  const otaConfig = zephyrOptions.otaConfig || {};
  const appUid = zephyrOptions.applicationUid || 'unknown';

  return `
// Zephyr OTA Initialization - React Native Compatible
(function() {
  var globalObj = (function() {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof global !== 'undefined') return global;
    if (typeof window !== 'undefined') return window;
    return {};
  })();

  if (globalObj.__ZEPHYR_RUNTIME_PLUGIN_INSTANCE__) {
    try {
      // Check if ZephyrOTAWorker is available (must be imported by user)
      var ZephyrOTAWorker = globalObj.__ZEPHYR_OTA_WORKER_CLASS__;

      if (!ZephyrOTAWorker) {
        console.warn('[Zephyr OTA] ZephyrOTAWorker not found. Make sure to import it in your app.');
        return;
      }

      var otaWorker = new ZephyrOTAWorker({
        applicationUid: '${appUid}',
        checkInterval: ${otaConfig.checkInterval || 30 * 60 * 1000},
        debug: ${Boolean(otaConfig.debug)},
        enableOTA: true
      }, {
        onUpdateAvailable: function(update) {
          console.log('[Zephyr OTA] Update available:', update.version);
          globalObj.__ZEPHYR_OTA_UPDATE_AVAILABLE__ && globalObj.__ZEPHYR_OTA_UPDATE_AVAILABLE__(update);
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
        }
      });

      // Connect to runtime plugin
      otaWorker.setRuntimePlugin(globalObj.__ZEPHYR_RUNTIME_PLUGIN_INSTANCE__);

      // Store globally and auto-start
      globalObj.__ZEPHYR_OTA_WORKER__ = otaWorker;

      // Check environment capability before starting
      if (globalObj.__ZEPHYR_BUNDLE_MANAGER__) {
        var envInfo = globalObj.__ZEPHYR_BUNDLE_MANAGER__.getEnvironmentInfo();
        console.log('[Zephyr OTA] Environment:', envInfo);
      }

      otaWorker.start();
      console.log('[Zephyr OTA] Worker initialized for environment');
    } catch (error) {
      console.warn('[Zephyr OTA] Failed to initialize OTA worker:', error);
    }
  }
})();
`;
}
