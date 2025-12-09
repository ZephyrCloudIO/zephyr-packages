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

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-var */

/** Zephyr manifest structure for runtime updates */
export interface ZephyrRuntimeManifest {
  version: string;
  timestamp: number;
  dependencies?: Record<string, string>;
  [key: string]: unknown;
}

/** Callback type for manifest change notifications */
export type ZephyrManifestChangeCallback = (
  newManifest: ZephyrRuntimeManifest,
  oldManifest: ZephyrRuntimeManifest | null
) => void;

declare global {
  /**
   * Zephyr runtime plugin instance - created by zephyr-xpack-internal. Used for OTA
   * updates and remote module resolution.
   */
  var __ZEPHYR_RUNTIME_PLUGIN__: unknown | undefined;

  /**
   * Zephyr runtime plugin singleton tracker. Prevents multiple initializations in the
   * same runtime.
   */
  var __ZEPHYR_RUNTIME_PLUGIN_INSTANCE__: unknown | undefined;

  /**
   * Optional callback invoked when the manifest changes. Can be set by application code
   * to react to OTA updates.
   */
  var __ZEPHYR_MANIFEST_CHANGED__: ZephyrManifestChangeCallback | undefined;

  // Browser/Web environment support (for React Native Web)
  interface Window {
    __ZEPHYR_RUNTIME_PLUGIN__?: unknown;
    __ZEPHYR_RUNTIME_PLUGIN_INSTANCE__?: unknown;
    __ZEPHYR_MANIFEST_CHANGED__?: ZephyrManifestChangeCallback;
  }
}

export {};
