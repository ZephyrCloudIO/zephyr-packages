import type { ZephyrManifest } from './zephyr-manifest';

/**
 * Enhanced Runtime Plugin Options for OTA support
 */
export interface ZephyrRuntimePluginOTAOptions {
  /** Called when manifest changes are detected */
  onManifestChange?: (newManifest: ZephyrManifest, oldManifest?: ZephyrManifest) => void;
  /** Called when manifest fetch fails */
  onManifestError?: (error: Error) => void;
  /** Custom manifest URL (defaults to /zephyr-manifest.json) */
  manifestUrl?: string;
}

/**
 * Runtime Plugin Instance for programmatic control
 */
export interface ZephyrRuntimePluginInstance {
  /** Refresh the manifest and check for changes */
  refresh: () => Promise<ZephyrManifest | undefined>;
  /** Get the current cached manifest */
  getCurrentManifest: () => Promise<ZephyrManifest | undefined>;
}

/**
 * Event detail for remote URL changes
 */
export interface ZephyrRemoteUrlChangeDetail {
  remoteName: string;
  oldUrl: string;
  newUrl: string;
  manifest: ZephyrManifest;
}

/**
 * Custom event type for remote URL changes
 */
export interface ZephyrRemoteUrlChangeEvent extends CustomEvent {
  type: 'zephyr:remote-url-changed';
  detail: ZephyrRemoteUrlChangeDetail;
}

/**
 * Enhanced runtime plugin creation function signature
 */
export type CreateZephyrRuntimePluginWithOTA = (
  options?: ZephyrRuntimePluginOTAOptions
) => {
  plugin: any; // FederationRuntimePlugin from module federation
  instance: ZephyrRuntimePluginInstance;
};

/**
 * Manifest cache entry structure for multi-app caching
 */
export interface ManifestCacheEntry {
  manifest: ZephyrManifest;
  timestamp: number;
  promise?: Promise<ZephyrManifest | undefined>;
}

/**
 * Global manifest cache type
 */
export type ManifestCache = Record<string, ManifestCacheEntry>;