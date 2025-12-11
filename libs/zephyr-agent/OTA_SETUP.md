# Zephyr OTA (Over-The-Air) Updates Setup Guide

This guide provides step-by-step instructions for implementing OTA updates in your React Native application using Zephyr's OTA system.

## Overview

Over-The-Air (OTA) updates allow you to deploy JavaScript bundle updates to your React Native application without requiring users to download a new version from the App Store or Play Store. With Zephyr OTA, you can:

- Deploy JavaScript and asset updates instantly
- Roll back to previous versions if needed
- Pre-download bundles for instant updates
- Target specific platforms (iOS/Android)
- Track update metrics and analytics
- Implement silent, user-prompted, or mandatory update strategies

## Prerequisites

Before implementing OTA updates, ensure you have:

- React Native 0.70 or higher
- A Zephyr Cloud account ([sign up](https://zephyr-cloud.io))
- `@react-native-async-storage/async-storage` installed
- (Optional) `@react-native-community/netinfo` for network-aware downloads

## Installation

Install the required packages:

```bash
# npm
npm install zephyr-agent @react-native-async-storage/async-storage

# yarn
yarn add zephyr-agent @react-native-async-storage/async-storage

# pnpm
pnpm add zephyr-agent @react-native-async-storage/async-storage
```

For network-aware bundle downloads (optional):

```bash
npm install @react-native-community/netinfo
```

## Quick Start

### Step 1: Import the OTA Worker

```typescript
// src/services/ota.ts
import { ZephyrOTAWorker } from 'zephyr-agent';
import type { ZephyrOTAConfig, ZephyrOTACallbacks, ZephyrOTAUpdate } from 'zephyr-agent';
```

### Step 2: Configure the OTA Worker

```typescript
// src/services/ota.ts
const config: ZephyrOTAConfig = {
  applicationUid: 'your-application-uid', // From Zephyr Cloud dashboard
  checkInterval: 30 * 60 * 1000, // Check every 30 minutes
  retryAttempts: 3, // Retry failed checks 3 times
  platform: 'ios', // or 'android'
  debug: __DEV__, // Enable debug logging in development
};

const callbacks: ZephyrOTACallbacks = {
  onUpdateAvailable: (update: ZephyrOTAUpdate) => {
    console.log('Update available:', update.version);
    // Handle update (show UI, auto-apply, etc.)
  },
  onUpdateError: (error: Error) => {
    console.error('Update check failed:', error);
  },
  onUpdateApplied: (version: string) => {
    console.log('Update applied successfully:', version);
  },
  onUpdateFailed: (error: Error) => {
    console.error('Failed to apply update:', error);
  },
};

export const otaWorker = new ZephyrOTAWorker(config, callbacks);
```

### Step 3: Initialize in Your App

```typescript
// App.tsx
import React, { useEffect } from 'react';
import { otaWorker } from './services/ota';

export default function App() {
  useEffect(() => {
    // Start OTA worker when app mounts
    otaWorker.start();

    return () => {
      // Clean up when app unmounts
      otaWorker.stop();
    };
  }, []);

  return (
    // Your app components
  );
}
```

### Step 4: Connect Runtime Plugin (Required)

The OTA worker needs a runtime plugin to refresh manifests:

```typescript
// src/services/ota.ts
import { createZephyrRuntimePlugin } from 'zephyr-agent';

// Create the runtime plugin with OTA support
const { plugin, instance } = createZephyrRuntimePlugin({
  manifestUrl: '/zephyr-manifest.json',
  onManifestChange: (newManifest, oldManifest) => {
    console.log('Manifest updated');
  },
  onManifestError: (error) => {
    console.error('Manifest error:', error);
  },
});

// Connect to OTA worker
otaWorker.setRuntimePlugin(instance);
```

## Configuration Reference

### ZephyrOTAConfig

| Option            | Type                    | Default                 | Description                                          |
| ----------------- | ----------------------- | ----------------------- | ---------------------------------------------------- |
| `applicationUid`  | `string`                | **Required**            | Your application UID from Zephyr Cloud               |
| `otaEndpoint`     | `string`                | `/__get_version_info__` | Custom OTA endpoint URL                              |
| `checkInterval`   | `number`                | `1800000` (30 min)      | Interval between update checks in milliseconds       |
| `retryAttempts`   | `number`                | `3`                     | Number of retry attempts for failed checks           |
| `platform`        | `'ios' \| 'android'`    | `'android'`             | Target platform                                      |
| `debug`           | `boolean`               | `false`                 | Enable debug logging                                 |
| `downloadManager` | `BundleDownloadManager` | `undefined`             | Optional download manager for bundle pre-downloading |
| `cacheManager`    | `BundleCacheManager`    | `undefined`             | Optional cache manager for bundle caching            |
| `downloadTimeout` | `number`                | `300000` (5 min)        | Download timeout in milliseconds                     |

### ZephyrOTACallbacks

| Callback             | Parameters                        | Description                                |
| -------------------- | --------------------------------- | ------------------------------------------ |
| `onUpdateAvailable`  | `(update: ZephyrOTAUpdate)`       | Called when a new update is available      |
| `onUpdateError`      | `(error: Error)`                  | Called when update check fails             |
| `onUpdateApplied`    | `(version: string)`               | Called when update is applied successfully |
| `onUpdateFailed`     | `(error: Error)`                  | Called when update application fails       |
| `onDownloadStart`    | `(update: ZephyrOTAUpdate)`       | Called when bundle download starts         |
| `onDownloadProgress` | `({ completed, total, percent })` | Called with download progress              |
| `onDownloadComplete` | `(update: ZephyrOTAUpdate)`       | Called when all bundles are downloaded     |

### ZephyrOTAUpdate

```typescript
interface ZephyrOTAUpdate {
  version: string; // Version identifier
  description?: string; // Update description
  critical?: boolean; // Whether update is critical/mandatory
  manifestUrl: string; // URL to the new manifest
  timestamp: string; // Update timestamp
  releaseNotes?: string; // Release notes
}
```

## Update Strategies

### 1. Silent Updates

Apply updates automatically in the background:

```typescript
const callbacks: ZephyrOTACallbacks = {
  onUpdateAvailable: async (update) => {
    // Automatically apply non-critical updates
    if (!update.critical) {
      try {
        await otaWorker.applyUpdate(update);
      } catch (error) {
        console.error('Silent update failed:', error);
      }
    }
  },
};
```

### 2. User-Prompted Updates

Show a dialog when updates are available:

```typescript
import { Alert } from 'react-native';

const callbacks: ZephyrOTACallbacks = {
  onUpdateAvailable: (update) => {
    Alert.alert('Update Available', `Version ${update.version} is available.\n\n${update.releaseNotes || 'Bug fixes and improvements.'}`, [
      {
        text: 'Later',
        style: 'cancel',
        onPress: () => otaWorker.declineUpdate(update.version),
      },
      {
        text: 'Update Now',
        onPress: () => otaWorker.applyUpdate(update),
      },
    ]);
  },
};
```

### 3. Mandatory Updates

Force updates for critical fixes:

```typescript
import { Alert } from 'react-native';

const callbacks: ZephyrOTACallbacks = {
  onUpdateAvailable: (update) => {
    if (update.critical) {
      Alert.alert(
        'Required Update',
        'A critical update is required to continue using the app.',
        [
          {
            text: 'Update Now',
            onPress: () => otaWorker.applyUpdate(update),
          },
        ],
        { cancelable: false }
      );
    } else {
      // Handle non-critical updates normally
    }
  },
};
```

## Advanced: Bundle Pre-downloading

For instant updates, pre-download bundles before applying:

### Step 1: Set Up Storage Layer

```typescript
import { BundleStorageLayer, BundleDownloadManager, BundleCacheManager, DownloadPriority, EvictionStrategy } from 'zephyr-agent';

// Create storage layer (handles file system operations)
const storageLayer = new BundleStorageLayer({
  cacheDirectory: '/path/to/cache', // Platform-specific cache directory
  maxSize: 100 * 1024 * 1024, // 100MB max cache
  debug: __DEV__,
});

await storageLayer.initialize();
```

### Step 2: Configure Download Manager

```typescript
const downloadManager = new BundleDownloadManager(
  storageLayer,
  {
    maxConcurrent: 3, // Max simultaneous downloads
    maxRetries: 3, // Retry failed downloads
    retryDelayMs: 1000, // Initial retry delay
    maxRetryDelayMs: 30000, // Max retry delay (exponential backoff)
    timeoutMs: 60000, // Download timeout
    wifiOnly: false, // Allow cellular downloads
    debug: __DEV__,
  },
  {
    onDownloadStart: (task) => {
      console.log(`Downloading: ${task.id}`);
    },
    onDownloadProgress: (task) => {
      console.log(`Progress: ${task.progress}%`);
    },
    onDownloadComplete: (task) => {
      console.log(`Completed: ${task.id}`);
    },
    onDownloadFailed: (task) => {
      console.error(`Failed: ${task.id}`, task.error);
    },
    onAllComplete: () => {
      console.log('All downloads complete!');
    },
  }
);
```

### Step 3: Configure Cache Manager

```typescript
const cacheManager = new BundleCacheManager(storageLayer, {
  maxCacheSize: 100 * 1024 * 1024, // 100MB
  maxVersionsPerApp: 3, // Keep 3 versions per app
  evictionStrategy: EvictionStrategy.LRU,
  minFreeSpace: 10 * 1024 * 1024, // Keep 10MB free
  autoCleanup: true, // Auto-cleanup on startup
  debug: __DEV__,
});

await cacheManager.initialize();
```

### Step 4: Connect to OTA Worker

```typescript
const otaWorker = new ZephyrOTAWorker(
  {
    applicationUid: 'your-app-uid',
    downloadManager,
    cacheManager,
    downloadTimeout: 5 * 60 * 1000, // 5 minutes
    debug: __DEV__,
  },
  {
    onUpdateAvailable: async (update) => {
      // Bundles will be pre-downloaded automatically
      await otaWorker.applyUpdate(update);
    },
    onDownloadProgress: ({ completed, total, percent }) => {
      console.log(`Downloading bundles: ${completed}/${total} (${percent}%)`);
    },
    onDownloadComplete: (update) => {
      console.log('All bundles ready for:', update.version);
    },
  }
);
```

## Download Priority Levels

When queueing bundles manually, use priority levels:

```typescript
enum DownloadPriority {
  CRITICAL = 0, // Main entry bundles - download first
  HIGH = 1, // Commonly used remote modules
  NORMAL = 2, // Standard bundles
  LOW = 3, // Lazy-loaded routes - download last
}

// Queue a bundle manually
await downloadManager.queueBundle(bundleMetadata, 'app-uid', '1.0.0', DownloadPriority.HIGH);
```

## Cache Eviction Strategies

Configure how bundles are evicted when cache is full:

```typescript
enum EvictionStrategy {
  LRU = 'lru', // Least Recently Used (default)
  FIFO = 'fifo', // First In First Out
  LARGEST_FIRST = 'largest_first', // Remove largest bundles first
}
```

## Monitoring & Metrics

### OTA Metrics

```typescript
const metrics = otaWorker.getMetrics();

console.log({
  checksPerformed: metrics.checksPerformed,
  updatesAvailable: metrics.updatesAvailable,
  updatesApplied: metrics.updatesApplied,
  updatesFailed: metrics.updatesFailed,
  lastCheckTimestamp: metrics.lastCheckTimestamp,
  lastUpdateTimestamp: metrics.lastUpdateTimestamp,
});
```

### Cache Metrics

```typescript
const cacheMetrics = cacheManager.getMetrics();

console.log({
  totalSize: cacheMetrics.totalSize,
  bundleCount: cacheMetrics.bundleCount,
  hits: cacheMetrics.hits,
  misses: cacheMetrics.misses,
  hitRate: cacheMetrics.hitRate, // 0-1
  utilization: cacheMetrics.utilization, // 0-1
  evictions: cacheMetrics.evictions,
});
```

### Download Statistics

```typescript
const stats = downloadManager.getStats();

console.log({
  queued: stats.queued,
  active: stats.active,
  completed: stats.completed,
  failed: stats.failed,
  total: stats.total,
});
```

## Platform-Specific Configuration

### iOS

```typescript
import { Platform } from 'react-native';

const config: ZephyrOTAConfig = {
  applicationUid: Platform.OS === 'ios' ? 'your-ios-app-uid' : 'your-android-app-uid',
  platform: 'ios',
  // iOS-specific settings
};
```

### Android

```typescript
const config: ZephyrOTAConfig = {
  applicationUid: 'your-android-app-uid',
  platform: 'android',
  // Android-specific settings
};
```

## Best Practices

1. **Test updates thoroughly** in staging before deploying to production
2. **Keep bundle sizes small** for faster downloads and better user experience
3. **Use WiFi-only mode** for large updates to save user data
4. **Implement rollback capability** to recover from failed updates
5. **Monitor update success rates** and investigate failures
6. **Use mandatory updates sparingly** - only for critical security fixes
7. **Provide offline support** - app should work if update fails
8. **Cache bundles locally** to avoid re-downloading
9. **Show download progress** for better user experience
10. **Handle background/foreground transitions** - the OTA worker does this automatically

## Troubleshooting

### Updates Not Detected

1. Verify `applicationUid` matches your Zephyr Cloud dashboard
2. Check network connectivity
3. Ensure OTA endpoint is accessible
4. Enable debug mode to see detailed logs

```typescript
const config: ZephyrOTAConfig = {
  applicationUid: 'your-app-uid',
  debug: true, // Enable detailed logging
};
```

### Updates Not Applying

1. Ensure runtime plugin is connected: `otaWorker.setRuntimePlugin(instance)`
2. Check for errors in `onUpdateFailed` callback
3. Verify manifest URL is accessible
4. Check AsyncStorage permissions

### Download Failures

1. Check network connection
2. Verify bundle URLs are accessible
3. Check integrity verification isn't failing
4. Review retry settings:

```typescript
const downloadManager = new BundleDownloadManager(storageLayer, {
  maxRetries: 5, // Increase retries
  retryDelayMs: 2000, // Longer initial delay
  timeoutMs: 120000, // Longer timeout
});
```

### Cache Issues

1. Check available storage space
2. Verify cache directory permissions
3. Try clearing the cache:

```typescript
await cacheManager.clearCache();
```

### App Crashes After Update

1. Implement rollback mechanism
2. Test updates in staging first
3. Use feature flags for gradual rollout
4. Monitor crash reports

## Security Considerations

1. **HTTPS Only**: All OTA communications use HTTPS
2. **Integrity Verification**: Bundles are verified with SHA-256 checksums
3. **Constant-time Comparison**: Prevents timing attacks on checksum verification
4. **Atomic Updates**: Two-phase commit prevents partial updates
5. **Secure Storage**: Bundle checksums stored securely
6. **Token Authentication**: API requests authenticated with Zephyr tokens

## API Reference

### ZephyrOTAWorker Methods

| Method                     | Parameters                    | Returns         | Description               |
| -------------------------- | ----------------------------- | --------------- | ------------------------- |
| `start()`                  | -                             | `Promise<void>` | Start the OTA worker      |
| `stop()`                   | -                             | `void`          | Stop the OTA worker       |
| `setRuntimePlugin(plugin)` | `ZephyrRuntimePluginInstance` | `void`          | Connect runtime plugin    |
| `applyUpdate(update)`      | `ZephyrOTAUpdate`             | `Promise<void>` | Apply an available update |
| `declineUpdate(version)`   | `string`                      | `Promise<void>` | Decline an update         |
| `getMetrics()`             | -                             | `OTAMetrics`    | Get current metrics       |

### BundleDownloadManager Methods

| Method                                           | Parameters           | Returns                     | Description               |
| ------------------------------------------------ | -------------------- | --------------------------- | ------------------------- |
| `queueBundle(bundle, appUid, version, priority)` | See signature        | `Promise<string>`           | Queue bundle for download |
| `queueBundles(bundles)`                          | Array of bundle info | `Promise<string[]>`         | Queue multiple bundles    |
| `start()`                                        | -                    | `Promise<void>`             | Start processing queue    |
| `stop()`                                         | -                    | `void`                      | Stop processing           |
| `cancelTask(taskId)`                             | `string`             | `void`                      | Cancel specific download  |
| `cancelAll()`                                    | -                    | `void`                      | Cancel all downloads      |
| `getStats()`                                     | -                    | `DownloadStats`             | Get download statistics   |
| `getTaskStatus(taskId)`                          | `string`             | `DownloadTask \| undefined` | Get task status           |

### BundleCacheManager Methods

| Method                              | Parameters          | Returns                   | Description               |
| ----------------------------------- | ------------------- | ------------------------- | ------------------------- |
| `initialize()`                      | -                   | `Promise<void>`           | Initialize cache manager  |
| `isCached(checksum)`                | `string`            | `Promise<boolean>`        | Check if bundle is cached |
| `enforceLimit()`                    | -                   | `Promise<EvictionResult>` | Enforce cache size limit  |
| `cleanupOldVersions(appUid, keep?)` | `string`, `number?` | `Promise<number>`         | Cleanup old versions      |
| `cleanupAllOldVersions()`           | -                   | `Promise<number>`         | Cleanup all old versions  |
| `clearCache()`                      | -                   | `Promise<number>`         | Clear entire cache        |
| `getMetrics()`                      | -                   | `CacheMetrics`            | Get cache metrics         |
| `resetMetrics()`                    | -                   | `void`                    | Reset hit/miss metrics    |

## Resources

- [Zephyr Documentation](https://docs.zephyr-cloud.io)
- [React Native Integration Guide](https://docs.zephyr-cloud.io/guides/react-native)
- [Module Federation with Metro](https://docs.zephyr-cloud.io/bundlers/metro)

## Support

For OTA-related questions or issues:

- [Discord Community](https://zephyr-cloud.io/discord)
- [GitHub Issues](https://github.com/ZephyrCloudIO/zephyr-packages/issues)
- [Documentation](https://docs.zephyr-cloud.io)
