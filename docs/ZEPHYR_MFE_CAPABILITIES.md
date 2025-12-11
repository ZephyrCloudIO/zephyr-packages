# Zephyr MFE Capabilities Guide

This document answers key questions about Zephyr's Module Federation (MFE) capabilities for remote modules, versioning, OTA updates, A/B testing, and caching strategies.

---

## Table of Contents

1. [Remote/MFE Capabilities](#1-remotemfe-capabilities)
2. [Reading MFE Version Remotely](#2-reading-mfe-version-remotely-before-fetching)
3. [Reading MFE Version Locally](#3-reading-mfe-version-locally-before-mounting)
4. [OTA Updates for MFEs](#4-ota-updates-for-mfes)
5. [Conditional MFEs and A/B Testing](#5-conditional-mfes-and-ab-testing)
6. [MFE Caching Strategies](#6-mfe-caching-strategies)
7. [Additional Capabilities](#7-additional-capabilities-to-consider)

---

## 1. Remote/MFE Capabilities

Zephyr provides a **manifest-based system** for managing federated remotes with runtime resolution.

### Core Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Host App      │      │  Zephyr Cloud    │      │  Remote MFE     │
│                 │      │                  │      │                 │
│ Runtime Plugin  │──────│  Manifest API    │──────│  remoteEntry.js │
│ ↓               │      │  Version API     │      │                 │
│ Resolve Remote  │      │  OTA Endpoint    │      │                 │
└─────────────────┘      └──────────────────┘      └─────────────────┘
```

### Manifest Structure

The `zephyr-manifest.json` is the source of truth for remote resolution:

```typescript
interface ZephyrManifest {
  version: string; // Semantic version
  timestamp: string; // ISO timestamp for freshness
  dependencies: Record<string, ZephyrDependency>; // Immutable remote URLs
  zeVars: Record<string, string>; // Environment variables
  ota_enabled?: boolean; // OTA support flag
  application_uid?: string; // App identifier
}

interface ZephyrDependency {
  application_uid: string;
  remote_entry_url: string; // Immutable URL for this version
  default_url: string;
  name: string;
  library_type: string;
  bundles?: BundleMetadata[]; // Optional OTA bundle metadata
}
```

**Source**: `libs/zephyr-edge-contract/src/lib/zephyr-manifest.ts`

### Key Capabilities

| Capability                       | Description                                | Source File                    |
| -------------------------------- | ------------------------------------------ | ------------------------------ |
| Runtime remote resolution        | Resolve remote URLs at runtime via plugins | `runtime-plugin.ts`            |
| Manifest versioning              | Semantic versioning with timestamps        | `zephyr-manifest.ts`           |
| Multi-platform support           | iOS, Android, Web                          | `app-version.ts`               |
| Build-time dependency resolution | Lock versions at compile time              | `resolve_remote_dependency.ts` |
| Session storage overrides        | Override URLs for development/testing      | `runtime-plugin.ts:180-196`    |

---

## 2. Reading MFE Version Remotely Before Fetching

**Yes, you can check MFE versions remotely before fetching.**

### OTA Version Check API

```typescript
// Request payload
interface OTACheckRequest {
  application_uid: string;
  current_version?: string; // Current version client has
  current_timestamp?: string; // Timestamp for comparison
  platform?: 'ios' | 'android';
}

// Response with version info
interface OTAVersionResponse {
  version: string;
  timestamp: string;
  manifest_url: string; // URL to fetch full manifest
  description?: string;
  critical?: boolean; // Critical update flag
  release_notes?: string;
}
```

### Usage Example

```typescript
// Check for updates without fetching bundles
async function checkRemoteVersion(applicationUid: string): Promise<OTAVersionResponse> {
  const response = await fetch('https://your-app.zephyr-cloud.io/__get_version_info__', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      application_uid: applicationUid,
      current_version: '1.0.0',
      current_timestamp: new Date().toISOString(),
    }),
  });
  return response.json();
}

// Usage
const versionInfo = await checkRemoteVersion('my-remote-app');
if (versionInfo.version !== currentVersion) {
  console.log(`New version available: ${versionInfo.version}`);
  // Decide whether to fetch based on version info
}
```

### Polling Configuration

```typescript
import { ZephyrOTAWorker } from 'zephyr-agent';

const worker = new ZephyrOTAWorker(
  {
    applicationUid: 'your-app-uid',
    checkInterval: 30 * 60 * 1000, // Default: 30 minutes
    retryAttempts: 3,
    platform: 'ios',
  },
  callbacks,
  runtimePlugin
);
```

**Source**: `libs/zephyr-agent/src/lib/ota/zephyr-ota-worker.ts:269-352`

---

## 3. Reading MFE Version Locally Before Mounting

**Yes, you can read cached manifest/version information before mounting.**

### Runtime Plugin Instance API

```typescript
interface ZephyrRuntimePluginInstance {
  /** Refresh the manifest and check for changes */
  refresh: () => Promise<ZephyrManifest | undefined>;

  /** Get the current cached manifest */
  getCurrentManifest: () => Promise<ZephyrManifest | undefined>;
}
```

### Usage Example

```typescript
import { createZephyrRuntimePluginMobile } from 'zephyr-xpack-internal';

const { plugin, instance } = createZephyrRuntimePluginMobile({
  manifestUrl: '/zephyr-manifest.json',
  onManifestChange: (newManifest, oldManifest) => {
    console.log('Manifest changed:', newManifest.version);
  },
});

// Before mounting a remote, check current manifest
async function getRemoteVersionBeforeMount(remoteName: string): Promise<string | null> {
  const manifest = await instance.getCurrentManifest();
  if (!manifest) return null;

  const dependency = manifest.dependencies[remoteName];
  return dependency ? manifest.version : null;
}

// Usage
const version = await getRemoteVersionBeforeMount('remoteApp');
if (shouldLoadVersion(version)) {
  // Proceed to mount the remote
  const RemoteComponent = await loadRemote('remoteApp/Component');
}
```

### Manifest Caching

```typescript
// Manifests are cached by application_uid with 5-minute TTL
interface ManifestCacheEntry {
  manifest: ZephyrManifest;
  timestamp: number;
  promise?: Promise<ZephyrManifest | undefined>;
}

// Global cache accessible across remotes
const manifestCache: Record<string, ManifestCacheEntry> = globalThis.__ZEPHYR_MANIFEST_CACHE__ || {};
```

**Source**: `libs/zephyr-xpack-internal/src/xpack-extract/runtime-plugin.ts:29-34`

---

## 4. OTA Updates for MFEs

### Current Implementation: Manifest-Only OTA

Zephyr implements a **manifest-only OTA system** with optional bundle pre-downloading:

```
┌───────────────┐    ┌─────────────────┐    ┌───────────────┐
│   App Start   │───▶│  OTA Worker     │───▶│ Check Version │
└───────────────┘    │  Initializes    │    └───────┬───────┘
                     └─────────────────┘            │
                                                    ▼
┌───────────────┐    ┌─────────────────┐    ┌───────────────┐
│  New Manifest │◀───│  Update Found   │◀───│ POST endpoint │
│  URLs Used    │    │  Callback       │    └───────────────┘
└───────────────┘    └─────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│ On App Restart: Remote modules load from new manifest URLs │
└───────────────────────────────────────────────────────────┘
```

### Setup Example

```typescript
import { ZephyrOTAWorker, ZephyrOTACallbacks } from 'zephyr-agent';
import { createZephyrRuntimePluginMobile } from 'zephyr-xpack-internal';

// 1. Create runtime plugin
const { plugin, instance } = createZephyrRuntimePluginMobile({
  manifestUrl: '/zephyr-manifest.json',
  onManifestChange: (newManifest) => {
    console.log('Manifest updated to version:', newManifest.version);
  },
});

// 2. Define callbacks
const callbacks: ZephyrOTACallbacks = {
  onUpdateAvailable: (update) => {
    console.log(`Update available: ${update.version}`);
    // Prompt user or auto-apply
    if (update.critical) {
      worker.applyUpdate(update);
    }
  },
  onUpdateApplied: (version) => {
    console.log(`Update ${version} applied. Restart to take effect.`);
  },
  onUpdateError: (error) => {
    console.error('Update check failed:', error);
  },
};

// 3. Initialize OTA worker
const worker = new ZephyrOTAWorker(
  {
    applicationUid: 'your-app-uid',
    checkInterval: 30 * 60 * 1000, // 30 minutes
    retryAttempts: 3,
    platform: 'ios',
    debug: true,
  },
  callbacks,
  instance
);

// 4. Start monitoring
worker.start();
```

### Storage Keys Used

```typescript
const STORAGE_KEYS = {
  CURRENT_VERSION: 'zephyr_ota_current_version',
  LAST_CHECK: 'zephyr_ota_last_check',
  UPDATE_DECLINED: 'zephyr_ota_declined_updates',
  METRICS: 'zephyr_ota_metrics',
} as const;
```

### OTA Callback Reference

| Callback                       | When Called                 |
| ------------------------------ | --------------------------- |
| `onUpdateAvailable(update)`    | New version detected        |
| `onUpdateError(error)`         | Version check failed        |
| `onUpdateApplied(version)`     | Update successfully applied |
| `onUpdateFailed(error)`        | Update application failed   |
| `onDownloadStart(update)`      | Bundle pre-download started |
| `onDownloadProgress(progress)` | Download progress update    |
| `onDownloadComplete(update)`   | All bundles downloaded      |

**Source**: `libs/zephyr-agent/src/lib/ota/zephyr-ota-worker.ts`

**Example App**: Check the React Native examples in the `examples/` directory for complete OTA integration.

---

## 5. Conditional MFEs and A/B Testing

### Session Storage Override Pattern

Zephyr supports **runtime URL overrides via sessionStorage** for A/B testing:

```typescript
// The runtime plugin checks sessionStorage before using manifest URL
function getResolvedRemoteUrl(resolvedRemote: ZephyrDependency): string {
  // Check for session storage override (for development/testing/A/B)
  const sessionEdgeURL = window.sessionStorage?.getItem(resolvedRemote.application_uid);

  // Use session URL if available, otherwise use manifest URL
  return sessionEdgeURL ?? resolvedRemote.remote_entry_url;
}
```

### A/B Testing Implementation

```typescript
// Variant assignment (do this on app initialization)
function assignVariant(applicationUid: string): 'control' | 'variant-a' | 'variant-b' {
  // Your variant assignment logic (feature flags, user segmentation, etc.)
  const userId = getUserId();
  const variant = hashUserToVariant(userId, ['control', 'variant-a', 'variant-b']);
  return variant;
}

// Set variant URL based on assignment
function setupABTest(applicationUid: string) {
  const variant = assignVariant(applicationUid);

  const variantUrls = {
    control: 'https://cdn.example.com/remote-v1.0.0/remoteEntry.js',
    'variant-a': 'https://cdn.example.com/remote-v1.0.0-variant-a/remoteEntry.js',
    'variant-b': 'https://cdn.example.com/remote-v1.0.0-variant-b/remoteEntry.js',
  };

  // Store in sessionStorage - runtime plugin will use this
  sessionStorage.setItem(applicationUid, variantUrls[variant]);
}

// Call before loading remotes
setupABTest('my-remote-app');
```

### Tag/Environment-Based Resolution

```typescript
// Remote versions can be resolved by tag or environment
interface ZeAppVersion {
  application_uid: string;
  version: string;
  remote_entry_url: string;
  tag?: string; // e.g., 'latest', 'stable', 'canary'
  env?: string; // e.g., 'production', 'staging', 'development'
}

// Build-time resolution supports tags
// In your build config:
const remotes = {
  remoteApp: 'remoteApp@https://app.zephyr-cloud.io/remotes/remoteApp@latest',
};
```

### Suggested A/B Testing Patterns

1. **Feature Flag Integration**

   ```typescript
   const shouldShowNewFeature = featureFlags.isEnabled('new-checkout-flow');
   if (shouldShowNewFeature) {
     sessionStorage.setItem('checkout-remote', 'https://.../v2/remoteEntry.js');
   }
   ```

2. **Gradual Rollout**

   ```typescript
   const rolloutPercentage = 10; // 10% of users
   if (Math.random() * 100 < rolloutPercentage) {
     sessionStorage.setItem('remote-app', newVersionUrl);
   }
   ```

3. **User Segment Testing**
   ```typescript
   if (user.isPremium) {
     sessionStorage.setItem('dashboard-remote', premiumDashboardUrl);
   }
   ```

**Source**: `libs/zephyr-xpack-internal/src/xpack-extract/runtime-plugin.ts:179-196`

---

## 6. MFE Caching Strategies

**Yes, caching strategy matters.** Zephyr provides configurable cache management.

### Eviction Strategies

```typescript
enum EvictionStrategy {
  LRU = 'lru', // Least Recently Used - evict oldest accessed
  FIFO = 'fifo', // First In First Out - evict oldest cached
  LARGEST_FIRST = 'largest_first', // Largest First - evict largest bundles
}
```

### Cache Policy Configuration

```typescript
interface CachePolicy {
  maxCacheSize?: number; // Max cache size (default: 100MB)
  maxVersionsPerApp?: number; // Max versions to keep (default: 3)
  evictionStrategy?: EvictionStrategy;
  minFreeSpace?: number; // Minimum free space (default: 10MB)
  autoCleanup?: boolean; // Auto-cleanup on startup
  debug?: boolean;
}
```

### Usage Example

```typescript
import { BundleCacheManager, EvictionStrategy } from 'zephyr-agent';

const cacheManager = new BundleCacheManager({
  maxCacheSize: 100 * 1024 * 1024, // 100MB
  maxVersionsPerApp: 3,
  evictionStrategy: EvictionStrategy.LRU,
  autoCleanup: true,
  debug: true,
});

// Use with runtime plugin
const { plugin, instance } = createZephyrRuntimePluginMobile({
  cacheManager,
  debug: true,
});
```

### Cache Metrics

```typescript
interface CacheMetrics {
  totalSize: number; // Total cache size in bytes
  bundleCount: number; // Number of cached bundles
  hits: number; // Cache hits
  misses: number; // Cache misses
  evictions: number; // Evictions performed
  hitRate: number; // Hit rate (0-1)
  utilization: number; // Utilization (0-1)
}

// Access metrics
const metrics = await cacheManager.getMetrics();
console.log(`Cache hit rate: ${(metrics.hitRate * 100).toFixed(1)}%`);
```

### Download Priority Levels

```typescript
enum DownloadPriority {
  CRITICAL = 0, // Main entry bundles
  HIGH = 1, // Commonly used remotes
  NORMAL = 2, // Standard bundles
  LOW = 3, // Lazy-loaded routes
}
```

### Recommendations

| Use Case                         | Recommended Strategy                | Why                             |
| -------------------------------- | ----------------------------------- | ------------------------------- |
| Mobile apps with limited storage | `LARGEST_FIRST`                     | Free up space quickly           |
| Frequent version switching       | `LRU`                               | Keep recently used versions     |
| Predictable rollouts             | `FIFO`                              | Oldest versions likely obsolete |
| Development/testing              | `LRU` with high `maxVersionsPerApp` | Keep multiple test versions     |

**Source**: `libs/zephyr-agent/src/lib/ota/bundle-cache-manager.ts`

---

## 7. Additional Capabilities to Consider

### Bundle Integrity Verification

```typescript
import { BundleIntegrityVerifier } from 'zephyr-agent';

const verifier = new BundleIntegrityVerifier({ algorithm: 'sha256' });

// Verify bundle before execution
const result = await verifier.verify(bundleMetadata, bundleData);
if (!result.valid) {
  console.error('Bundle integrity check failed:', result.error);
}
```

**Source**: `libs/zephyr-agent/src/lib/ota/bundle-integrity.ts`

### Environment Variables in Manifest

```typescript
// Access environment variables from manifest
const manifest = await instance.getCurrentManifest();
const apiUrl = manifest?.zeVars['ZE_PUBLIC_API_URL'];
```

### Network-Aware Downloading

```typescript
enum NetworkType {
  WIFI = 'wifi', // Allow all downloads
  CELLULAR = 'cellular', // Limit concurrent downloads
  NONE = 'none', // Queue for later
  UNKNOWN = 'unknown',
}

// Configure download behavior based on network
const downloadManager = new BundleDownloadManager({
  maxConcurrentDownloads: {
    wifi: 6,
    cellular: 2,
  },
});
```

### Application Configuration Caching

```typescript
// Configuration is cached for 60 seconds to reduce API calls
const config = await getApplicationConfiguration({
  application_uid: 'your-app-uid',
});
// Subsequent calls within 60s return cached value
```

### Multi-Bundler Support

Zephyr plugins are available for:

- Webpack (`zephyr-webpack-plugin`)
- Rspack (`zephyr-rspack-plugin`)
- Vite (`vite-plugin-zephyr`)
- Rollup (`rollup-plugin-zephyr`)
- Metro/React Native (`zephyr-metro-plugin`)
- Rsbuild (`zephyr-rsbuild-plugin`)

### Critical Update Flags

```typescript
interface OTAManifest {
  critical?: boolean; // Force immediate update
  min_app_version?: string; // Minimum app version required
  release_notes?: string; // User-facing release notes
}

// Handle critical updates
callbacks.onUpdateAvailable = (update) => {
  if (update.critical) {
    // Force update without user prompt
    worker.applyUpdate(update);
  } else {
    // Show update dialog
    showUpdatePrompt(update);
  }
};
```

### Version Decline Tracking

```typescript
// Track declined updates to avoid re-prompting
await worker.declineUpdate('1.0.1');

// Check if version was declined
const isDeclined = await worker.isUpdateDeclined('1.0.1');
```

---

## Quick Reference

| Question                          | Answer                                               | Key Files                 |
| --------------------------------- | ---------------------------------------------------- | ------------------------- |
| Can we read MFE version remotely? | Yes, via `/__get_version_info__` endpoint            | `zephyr-ota-worker.ts`    |
| Can we read MFE version locally?  | Yes, via `getCurrentManifest()`                      | `runtime-plugin.ts`       |
| Can we update MFEs via OTA?       | Yes, manifest-only with optional bundle pre-download | `zephyr-ota-worker.ts`    |
| A/B testing support?              | Yes, via sessionStorage URL overrides                | `runtime-plugin.ts`       |
| Should we care about caching?     | Yes, configure based on use case                     | `bundle-cache-manager.ts` |

---

## Related Documentation

- [OTA Setup Guide](../libs/zephyr-metro-plugin/OTA_SETUP.md) - Complete OTA setup for React Native
- [Examples Directory](../examples/) - Working examples for various bundlers
