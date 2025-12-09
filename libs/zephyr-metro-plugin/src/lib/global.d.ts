/**
 * Global type declarations for Zephyr Metro Plugin runtime.
 *
 * These globals are intentionally added to enable runtime plugin functionality in React
 * Native applications. The runtime plugin is injected into entry files and uses these
 * global variables to maintain state across the application.
 *
 * @see zephyr-transformer.ts for injection logic
 * @see zephyr-xpack-internal for runtime plugin implementation
 */

/* eslint-disable no-var */

/** Zephyr manifest structure for runtime updates */
export interface ZephyrRuntimeManifest {
  /** Semantic version of the manifest format */
  version: string;
  /** Unix timestamp when manifest was generated */
  timestamp: number;
  /** Map of remote module names to their resolved URLs */
  dependencies?: Record<string, string>;
  /** Additional manifest metadata */
  [key: string]: unknown;
}

/** Callback type for manifest change notifications */
export type ZephyrManifestChangeCallback = (
  newManifest: ZephyrRuntimeManifest,
  oldManifest: ZephyrRuntimeManifest | null
) => void;

/**
 * Configuration options for creating the Zephyr runtime plugin.
 * Passed to createZephyrRuntimePlugin from zephyr-xpack-internal.
 */
export interface ZephyrRuntimePluginOptions {
  /** URL endpoint to fetch the manifest from (e.g., '/zephyr-manifest.json') */
  manifestUrl: string;
  /** Polling interval in milliseconds for checking manifest updates (optional) */
  pollInterval?: number;
  /** Whether to automatically apply updates when manifest changes (optional) */
  autoUpdate?: boolean;
}

/**
 * Interface for the Zephyr runtime plugin instance.
 * Created by zephyr-xpack-internal's createZephyrRuntimePlugin function.
 *
 * Note: The actual implementation is in zephyr-xpack-internal which is an
 * optional peer dependency. If not installed, runtime features will be
 * disabled but the app will continue to work.
 */
export interface ZephyrRuntimePlugin {
  /** Manually fetch and apply the latest manifest */
  refresh(): Promise<void>;
  /** Get the current manifest */
  getManifest(): ZephyrRuntimeManifest | null;
  /** Register a callback for manifest changes */
  onManifestChange(callback: ZephyrManifestChangeCallback): () => void;
  /** Start polling for manifest updates */
  startPolling(interval?: number): void;
  /** Stop polling for manifest updates */
  stopPolling(): void;
  /** Check if the plugin is initialized */
  isInitialized(): boolean;
}

declare global {
  /**
   * Zephyr runtime plugin instance - created by zephyr-xpack-internal.
   * Used for OTA updates and remote module resolution.
   *
   * This global is set by the code injected by zephyr-transformer.ts
   * when the app starts. It will be undefined if:
   * - zephyr-xpack-internal is not installed
   * - The runtime plugin failed to initialize
   * - The code hasn't been executed yet
   */
  var __ZEPHYR_RUNTIME_PLUGIN__: ZephyrRuntimePlugin | undefined;

  /**
   * Zephyr runtime plugin singleton tracker.
   * Prevents multiple initializations in the same runtime.
   * Set to the same instance as __ZEPHYR_RUNTIME_PLUGIN__ after initialization.
   */
  var __ZEPHYR_RUNTIME_PLUGIN_INSTANCE__: ZephyrRuntimePlugin | undefined;

  /**
   * Optional callback invoked when the manifest changes.
   * Can be set by application code to react to OTA updates.
   *
   * @example
   * ```typescript
   * global.__ZEPHYR_MANIFEST_CHANGED__ = (newManifest, oldManifest) => {
   *   console.log('Manifest updated:', newManifest.version);
   *   // Trigger app reload or notify user
   * };
   * ```
   */
  var __ZEPHYR_MANIFEST_CHANGED__: ZephyrManifestChangeCallback | undefined;

  /**
   * Module Federation global config set by Metro bundler.
   * Used by zephyrCommandWrapper to access the MF configuration.
   */
  var __METRO_FEDERATION_CONFIG:
    | {
        name: string;
        filename?: string;
        remotes?: Record<string, string>;
        exposes?: Record<string, string>;
        shared?: Record<string, unknown>;
      }
    | undefined;

  // Browser/Web environment support (for React Native Web)
  interface Window {
    __ZEPHYR_RUNTIME_PLUGIN__?: ZephyrRuntimePlugin;
    __ZEPHYR_RUNTIME_PLUGIN_INSTANCE__?: ZephyrRuntimePlugin;
    __ZEPHYR_MANIFEST_CHANGED__?: ZephyrManifestChangeCallback;
  }
}

export {};
