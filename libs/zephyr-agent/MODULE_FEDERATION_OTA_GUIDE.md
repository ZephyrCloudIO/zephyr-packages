# Module Federation + OTA: Apps Inside Your App

This guide explains how to use Zephyr's Module Federation with OTA updates to create independently deployable mini-apps (remotes) within your React Native host application.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Host App Setup](#host-app-setup)
5. [Remote Module Setup](#remote-module-setup)
6. [Loading Remote Modules](#loading-remote-modules)
7. [OTA Updates for Remotes](#ota-updates-for-remotes)
8. [The Manifest System](#the-manifest-system)
9. [Bundle Pre-downloading](#bundle-pre-downloading)
10. [Testing the Flow](#testing-the-flow)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

---

## Overview

Module Federation allows you to split your React Native app into independently built and deployed modules. Combined with Zephyr's OTA system, you can:

- **Deploy features independently** - Update the "payments" module without touching "auth"
- **Instant updates** - Push changes to users without app store review
- **Rollback per module** - Revert a specific mini-app without affecting others
- **Lazy loading** - Load modules on-demand to reduce initial bundle size
- **Team autonomy** - Different teams own different remotes

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         HOST APP                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  zephyr-manifest.json                                      │ │
│  │  {                                                         │ │
│  │    "auth": "https://cdn.zephyr.io/auth/v1.2.0/remote.js"   │ │
│  │    "payments": "https://cdn.zephyr.io/payments/v2.0.0/..." │ │
│  │    "dashboard": "https://cdn.zephyr.io/dashboard/v1.0.0/." │ │
│  │  }                                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│              ┌───────────────┼───────────────┐                   │
│              ▼               ▼               ▼                   │
│       ┌──────────┐    ┌────────────┐   ┌───────────┐            │
│       │   Auth   │    │  Payments  │   │ Dashboard │            │
│       │ (remote) │    │  (remote)  │   │  (remote) │            │
│       │  v1.2.0  │    │   v2.0.0   │   │   v1.0.0  │            │
│       └──────────┘    └────────────┘   └───────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      OTA UPDATE FLOW                             │
│                                                                  │
│  1. OTA Worker polls /__get_version_info__                       │
│  2. Server responds: new manifest available                      │
│  3. User accepts update                                          │
│  4. Runtime plugin refreshes manifest                            │
│  5. New remote URLs are now active                               │
│  6. Next load of remote → fetches updated bundle                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### How It Works

1. **Host App** loads a manifest that maps remote module names to their bundle URLs
2. **Runtime Plugin** intercepts dynamic imports like `import('auth/LoginScreen')`
3. **URL Resolution** - Plugin looks up the actual URL from the manifest
4. **Bundle Loading** - Module Federation fetches and executes the remote bundle
5. **OTA Updates** - When you deploy a new remote version, the manifest URLs change
6. **Refresh** - OTA Worker detects the change and refreshes the manifest

---

## Prerequisites

Before starting, ensure you have:

- React Native 0.70 or higher
- A Zephyr Cloud account ([sign up](https://zephyr-cloud.io))
- Host app set up with Zephyr Metro Plugin (see [QA_GUIDE_SETUP.md](./QA_GUIDE_SETUP.md))
- `@react-native-async-storage/async-storage` installed

Install required packages:

```bash
# Core dependencies
npm install zephyr-metro-plugin zephyr-agent

# Required for OTA state persistence
npm install @react-native-async-storage/async-storage

# Optional: Network-aware downloads
npm install @react-native-community/netinfo
```

---

## Host App Setup

### Step 1: Configure Metro with Remotes

Update your `metro.config.js` to declare remote modules:

```javascript
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withZephyr } = require('zephyr-metro-plugin');

const baseConfig = getDefaultConfig(__dirname);

module.exports = (async () => {
  const zephyrConfig = await withZephyr({
    // Your host app name
    name: 'MainApp',

    // Declare remote modules (mini-apps)
    remotes: {
      auth: 'https://cdn.zephyr.io/auth',
      payments: 'https://cdn.zephyr.io/payments',
      dashboard: 'https://cdn.zephyr.io/dashboard',
    },

    // Target platform
    target: process.env.PLATFORM || 'ios',

    // Enable OTA updates
    enableOTA: true,

    // Your application UID from Zephyr Cloud dashboard
    applicationUid: 'your-main-app-uid',

    // Manifest endpoint (default)
    manifestPath: '/zephyr-manifest.json',
  })(baseConfig);

  return mergeConfig(baseConfig, zephyrConfig);
})();
```

### Step 2: Initialize Runtime Plugin and OTA

Create `src/services/ZephyrService.ts`:

```typescript
import { ZephyrOTAWorker } from 'zephyr-agent';
import type { ZephyrOTAUpdate, ZephyrOTACallbacks, ZephyrOTAConfig } from 'zephyr-agent';
import { Alert, Platform } from 'react-native';

// Configuration
const OTA_CONFIG: ZephyrOTAConfig = {
  applicationUid: 'your-main-app-uid', // From Zephyr Cloud dashboard
  platform: Platform.OS as 'ios' | 'android',
  checkInterval: 30 * 60 * 1000, // Check every 30 minutes
  retryAttempts: 3,
  debug: __DEV__,
};

// Callbacks for OTA events
const OTA_CALLBACKS: ZephyrOTACallbacks = {
  onUpdateAvailable: (update: ZephyrOTAUpdate) => {
    console.log('[Zephyr] Update available:', update.version);

    Alert.alert('Update Available', `Version ${update.version} is ready.\n\n${update.description || 'New features and improvements.'}`, [
      {
        text: 'Later',
        style: 'cancel',
        onPress: () => {
          console.log('[Zephyr] Update declined');
          otaWorker.declineUpdate(update.version);
        },
      },
      {
        text: 'Update Now',
        onPress: async () => {
          console.log('[Zephyr] Applying update...');
          try {
            await otaWorker.applyUpdate(update);
          } catch (error) {
            console.error('[Zephyr] Update failed:', error);
            Alert.alert('Update Failed', 'Please try again later.');
          }
        },
      },
    ]);
  },

  onUpdateApplied: (version: string) => {
    console.log('[Zephyr] Update applied:', version);
    Alert.alert('Update Complete', `Now running version ${version}`);
  },

  onUpdateError: (error: Error) => {
    console.error('[Zephyr] Update check error:', error);
  },

  onUpdateFailed: (error: Error) => {
    console.error('[Zephyr] Update apply failed:', error);
  },
};

// Create OTA Worker instance
export const otaWorker = new ZephyrOTAWorker(OTA_CONFIG, OTA_CALLBACKS);

// Initialize Zephyr (call this in App.tsx useEffect)
export function initializeZephyr(): void {
  // Connect OTA worker to runtime plugin (auto-injected by Metro plugin)
  if (global.__ZEPHYR_RUNTIME_PLUGIN_INSTANCE__) {
    otaWorker.setRuntimePlugin(global.__ZEPHYR_RUNTIME_PLUGIN_INSTANCE__);
    console.log('[Zephyr] Runtime plugin connected');
  } else {
    console.warn('[Zephyr] Runtime plugin not found - OTA updates will not work');
  }

  // Start OTA worker
  otaWorker.start();
  console.log('[Zephyr] OTA Worker started');
}

// Cleanup (call in App.tsx useEffect cleanup)
export function cleanupZephyr(): void {
  otaWorker.stop();
  console.log('[Zephyr] OTA Worker stopped');
}

// Get current metrics
export function getZephyrMetrics() {
  return otaWorker.getMetrics();
}
```

### Step 3: Initialize in App Entry Point

Update your `App.tsx`:

```tsx
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { initializeZephyr, cleanupZephyr } from './services/ZephyrService';

// Import screens (some from remotes, some local)
import HomeScreen from './screens/HomeScreen';
import { AuthNavigator } from './navigation/AuthNavigator';
import { PaymentsNavigator } from './navigation/PaymentsNavigator';

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    // Initialize Zephyr runtime + OTA
    initializeZephyr();

    return () => {
      cleanupZephyr();
    };
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Auth" component={AuthNavigator} />
        <Stack.Screen name="Payments" component={PaymentsNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

## Remote Module Setup

Each remote module is a separate React Native project/package that exposes components.

### Remote Project Structure

```
auth-remote/
├── src/
│   ├── screens/
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   └── ForgotPasswordScreen.tsx
│   ├── hooks/
│   │   └── useAuth.ts
│   └── index.ts          # Entry point - exposes modules
├── metro.config.js
├── package.json
└── zephyr.config.js
```

### Remote package.json

```json
{
  "name": "auth-remote",
  "version": "1.0.0",
  "main": "src/index.ts",
  "mfConfig": {
    "name": "auth",
    "exposes": {
      "./LoginScreen": "./src/screens/LoginScreen",
      "./RegisterScreen": "./src/screens/RegisterScreen",
      "./ForgotPasswordScreen": "./src/screens/ForgotPasswordScreen",
      "./useAuth": "./src/hooks/useAuth"
    },
    "shared": {
      "react": { "singleton": true },
      "react-native": { "singleton": true }
    }
  }
}
```

### Remote metro.config.js

```javascript
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withZephyr } = require('zephyr-metro-plugin');

const baseConfig = getDefaultConfig(__dirname);

module.exports = (async () => {
  const zephyrConfig = await withZephyr({
    name: 'auth',
    target: process.env.PLATFORM || 'ios',
    applicationUid: 'auth-remote-uid',
    // This is a remote, not a host
    isRemote: true,
  })(baseConfig);

  return mergeConfig(baseConfig, zephyrConfig);
})();
```

### Exposed Components (src/index.ts)

```typescript
// Re-export everything this remote exposes
export { default as LoginScreen } from './screens/LoginScreen';
export { default as RegisterScreen } from './screens/RegisterScreen';
export { default as ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
export { useAuth } from './hooks/useAuth';
```

---

## Loading Remote Modules

### Option 1: Lazy Loading with React.lazy

```tsx
import React, { lazy, Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';

// Lazy load screens from remote modules
const LoginScreen = lazy(() => import('auth/LoginScreen'));
const CheckoutScreen = lazy(() => import('payments/CheckoutScreen'));
const DashboardScreen = lazy(() => import('dashboard/DashboardScreen'));

// Loading fallback component
function LoadingFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

// Use in navigation
function AuthNavigator() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Stack.Navigator>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    </Suspense>
  );
}
```

### Option 2: Dynamic Import with Error Handling

```tsx
import React, { useState, useEffect, ComponentType } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

interface RemoteModuleLoaderProps {
  remoteName: string;
  moduleName: string;
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
}

function RemoteModuleLoader({ remoteName, moduleName, fallback, errorFallback }: RemoteModuleLoaderProps) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadModule() {
      try {
        setLoading(true);
        setError(null);

        // Dynamic import from remote
        const module = await import(`${remoteName}/${moduleName}`);
        setComponent(() => module.default || module[moduleName]);
      } catch (err) {
        console.error(`[RemoteLoader] Failed to load ${remoteName}/${moduleName}:`, err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    loadModule();
  }, [remoteName, moduleName]);

  if (loading) {
    return fallback || <ActivityIndicator size="large" />;
  }

  if (error) {
    return (
      errorFallback || (
        <View style={{ padding: 20 }}>
          <Text style={{ color: 'red' }}>Failed to load module: {error.message}</Text>
        </View>
      )
    );
  }

  if (!Component) {
    return null;
  }

  return <Component />;
}

// Usage
<RemoteModuleLoader remoteName="auth" moduleName="LoginScreen" />;
```

### Option 3: Using Hooks from Remotes

```tsx
import React from 'react';
import { View, Text, Button } from 'react-native';

// Import hook from remote
import { useAuth } from 'auth/useAuth';

function ProfileScreen() {
  const { user, logout, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Text>Please log in</Text>;
  }

  return (
    <View>
      <Text>Welcome, {user.name}!</Text>
      <Button title="Logout" onPress={logout} />
    </View>
  );
}
```

---

## OTA Updates for Remotes

### How Remote Updates Work

1. **Deploy new remote version** to Zephyr Cloud
2. **Manifest updates** with new remote URLs
3. **OTA Worker detects** version change
4. **Runtime plugin refreshes** manifest
5. **Next remote load** fetches updated bundle

### Deploying a Remote Update

```bash
# In the remote project directory
cd auth-remote

# Make changes to the remote
# ... edit code ...

# Build and deploy
PLATFORM=ios NODE_ENV=production npm run build

# Zephyr uploads to CDN and updates manifest
```

### What Happens in the Host App

```
┌─────────────────────────────────────────────────────────┐
│ Timeline of Remote Update                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ T+0:  Auth remote v1.0.0 deployed                       │
│       Manifest: auth → cdn.zephyr.io/auth/v1.0.0/...    │
│                                                         │
│ T+1h: Developer pushes auth v1.1.0                      │
│       Manifest updated: auth → cdn.zephyr.io/auth/v1.1.0│
│                                                         │
│ T+1h30m: OTA Worker checks for updates                  │
│          Detects manifest version change                │
│          Triggers onUpdateAvailable callback            │
│                                                         │
│ T+1h31m: User taps "Update Now"                         │
│          OTA Worker calls runtime.refresh()             │
│          New manifest loaded into memory                │
│                                                         │
│ T+1h32m: User navigates to Auth screen                  │
│          import('auth/LoginScreen') resolves            │
│          Runtime plugin looks up URL in NEW manifest    │
│          Fetches v1.1.0 bundle from CDN                 │
│          User sees updated Auth screen!                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Silent Updates for Non-Critical Changes

```typescript
const OTA_CALLBACKS: ZephyrOTACallbacks = {
  onUpdateAvailable: async (update: ZephyrOTAUpdate) => {
    // Auto-apply non-critical updates silently
    if (!update.critical) {
      console.log('[Zephyr] Auto-applying update:', update.version);
      await otaWorker.applyUpdate(update);
      return;
    }

    // Show dialog for critical updates
    Alert.alert('Required Update', 'A critical update is required.', [{ text: 'Update Now', onPress: () => otaWorker.applyUpdate(update) }]);
  },
};
```

---

## The Manifest System

The `zephyr-manifest.json` is the central contract between host and remotes.

### Manifest Structure

```json
{
  "version": "1.2.0",
  "timestamp": "2025-01-15T10:30:00Z",
  "application_uid": "main-app-uid",
  "ota_enabled": true,
  "dependencies": {
    "auth": {
      "name": "auth",
      "application_uid": "auth-remote-uid",
      "remote_entry_url": "https://cdn.zephyr.io/auth/v1.2.0/remoteEntry.js",
      "default_url": "https://fallback.zephyr.io/auth/remoteEntry.js",
      "library_type": "module",
      "bundles": [
        {
          "url": "https://cdn.zephyr.io/auth/v1.2.0/LoginScreen.chunk.js",
          "checksum": "sha256-abc123def456...",
          "size": 45678,
          "contentType": "application/javascript",
          "path": "auth/LoginScreen.chunk.js"
        },
        {
          "url": "https://cdn.zephyr.io/auth/v1.2.0/RegisterScreen.chunk.js",
          "checksum": "sha256-789xyz...",
          "size": 34567,
          "contentType": "application/javascript",
          "path": "auth/RegisterScreen.chunk.js"
        }
      ]
    },
    "payments": {
      "name": "payments",
      "application_uid": "payments-remote-uid",
      "remote_entry_url": "https://cdn.zephyr.io/payments/v2.0.0/remoteEntry.js",
      "bundles": [
        {
          "url": "https://cdn.zephyr.io/payments/v2.0.0/CheckoutScreen.chunk.js",
          "checksum": "sha256-checkout123...",
          "size": 67890
        }
      ]
    }
  },
  "zeVars": {
    "API_URL": "https://api.example.com",
    "FEATURE_FLAGS": "dark_mode,new_checkout"
  }
}
```

### Key Manifest Fields

| Field              | Description                                       |
| ------------------ | ------------------------------------------------- |
| `version`          | Manifest version (triggers OTA update detection)  |
| `timestamp`        | When manifest was generated                       |
| `dependencies`     | Map of remote name → remote configuration         |
| `remote_entry_url` | Main entry point for the remote module            |
| `bundles`          | Individual chunk files with checksums for caching |
| `checksum`         | SHA-256 hash for integrity verification           |
| `zeVars`           | Environment variables passed to remotes           |

### Accessing the Manifest

```bash
# Fetch current manifest
curl https://your-app.zephyr-cloud.io/zephyr-manifest.json

# Check specific remote version
curl https://your-app.zephyr-cloud.io/zephyr-manifest.json | jq '.dependencies.auth'
```

---

## Bundle Pre-downloading

For instant updates without waiting for bundle download when user navigates:

### Setup Bundle Pre-downloading

```typescript
import { ZephyrOTAWorker, BundleStorageLayer, BundleDownloadManager, BundleCacheManager, EvictionStrategy } from 'zephyr-agent';
import RNFS from 'react-native-fs';

// 1. Create storage layer
const storageLayer = new BundleStorageLayer({
  cacheDirectory: `${RNFS.DocumentDirectoryPath}/zephyr-bundles`,
  maxSize: 100 * 1024 * 1024, // 100MB
  debug: __DEV__,
});

// 2. Create download manager
const downloadManager = new BundleDownloadManager(
  storageLayer,
  {
    maxConcurrent: 3,
    maxRetries: 3,
    retryDelayMs: 1000,
    timeoutMs: 60000,
    wifiOnly: false, // Set true to only download on WiFi
    debug: __DEV__,
  },
  {
    onDownloadProgress: (task) => {
      console.log(`[Download] ${task.id}: ${task.progress}%`);
    },
    onAllComplete: () => {
      console.log('[Download] All bundles ready!');
    },
  }
);

// 3. Create cache manager
const cacheManager = new BundleCacheManager(storageLayer, {
  maxCacheSize: 100 * 1024 * 1024, // 100MB
  maxVersionsPerApp: 3, // Keep 3 versions per remote
  evictionStrategy: EvictionStrategy.LRU,
  autoCleanup: true,
  debug: __DEV__,
});

// 4. Initialize
await storageLayer.initialize();
await cacheManager.initialize();

// 5. Create OTA Worker with managers
const otaWorker = new ZephyrOTAWorker(
  {
    applicationUid: 'your-app-uid',
    downloadManager, // Enable bundle pre-downloading
    cacheManager, // Enable caching
    downloadTimeout: 5 * 60 * 1000, // 5 minutes
    debug: __DEV__,
  },
  {
    onUpdateAvailable: async (update) => {
      // Bundles will be pre-downloaded automatically
      await otaWorker.applyUpdate(update);
    },
    onDownloadProgress: ({ completed, total, percent }) => {
      console.log(`Downloading: ${completed}/${total} (${percent}%)`);
    },
    onDownloadComplete: (update) => {
      console.log('All bundles cached for:', update.version);
    },
  }
);
```

### Benefits of Pre-downloading

| Without Pre-download               | With Pre-download                  |
| ---------------------------------- | ---------------------------------- |
| User taps update → manifest loaded | User taps update → manifest loaded |
| User navigates → bundle downloads  | Bundles download in background     |
| User waits for download...         | User navigates → instant load! ⚡  |
| Finally sees new screen            | Bundles served from local cache    |

---

## Testing the Flow

### Test Scenario: Update a Remote Module

#### Step 1: Deploy Initial Versions

```bash
# Deploy host app
cd host-app
PLATFORM=ios NODE_ENV=production npm run build

# Deploy auth remote v1.0.0
cd ../auth-remote
PLATFORM=ios NODE_ENV=production npm run build

# Note the deployment URLs from Zephyr output
```

#### Step 2: Install and Run Host App

```bash
cd host-app
npm run ios
```

Verify:

- [ ] App loads successfully
- [ ] Can navigate to Auth screens
- [ ] Auth screens show v1.0.0 content

#### Step 3: Update the Remote

```bash
cd auth-remote

# Make a visible change
# e.g., change button color, add text, update version display

# Deploy new version
PLATFORM=ios NODE_ENV=production npm run build
```

#### Step 4: Verify OTA Update

In the running host app:

- [ ] Wait for OTA check (or trigger manually)
- [ ] Update dialog appears
- [ ] Tap "Update Now"
- [ ] Navigate to Auth screen
- [ ] See updated content from new remote version!

### Debug Logging

Enable debug mode to see the full flow:

```typescript
const otaWorker = new ZephyrOTAWorker({
  applicationUid: 'your-app-uid',
  debug: true, // Enable verbose logging
});
```

Console output:

```
[ZephyrOTA] OTA Worker initialized
[ZephyrOTA] Starting OTA Worker
[ZephyrOTA] Checking for updates...
[ZephyrOTA] Current version: 1.0.0
[ZephyrOTA] Server version: 1.1.0
[ZephyrOTA] Update available: { version: "1.1.0", ... }
[ZephyrOTA] Applying update...
[ZephyrOTA] Refreshing runtime plugin...
[ZephyrOTA] Manifest refreshed
[ZephyrOTA] Update applied successfully
```

---

## Best Practices

### 1. Version Your Remotes Semantically

```json
{
  "version": "1.2.3"
}
```

- **Major** (1.x.x): Breaking changes, requires host update
- **Minor** (x.2.x): New features, backward compatible
- **Patch** (x.x.3): Bug fixes

### 2. Share Dependencies Properly

In remote's `mfConfig`:

```json
{
  "shared": {
    "react": { "singleton": true, "requiredVersion": "^18.0.0" },
    "react-native": { "singleton": true },
    "@react-navigation/native": { "singleton": true }
  }
}
```

### 3. Handle Loading States

Always wrap remote imports with Suspense and error boundaries:

```tsx
<ErrorBoundary fallback={<ErrorScreen />}>
  <Suspense fallback={<LoadingScreen />}>
    <RemoteScreen />
  </Suspense>
</ErrorBoundary>
```

### 4. Test Offline Scenarios

Ensure your app works when:

- Network is unavailable
- Remote bundle fails to load
- OTA check times out

### 5. Monitor Update Metrics

```typescript
const metrics = otaWorker.getMetrics();
console.log({
  checksPerformed: metrics.checksPerformed,
  updatesApplied: metrics.updatesApplied,
  updatesFailed: metrics.updatesFailed,
});

// Send to analytics
analytics.track('ota_metrics', metrics);
```

### 6. Gradual Rollouts

Deploy to a percentage of users first:

- Deploy to staging environment
- Test thoroughly
- Roll out to 10% of production users
- Monitor for crashes/errors
- Gradually increase to 100%

---

## Troubleshooting

### Remote Module Fails to Load

**Symptoms:** Error when importing from remote, blank screen

**Checklist:**

1. [ ] Is the remote deployed to Zephyr Cloud?
2. [ ] Is the manifest URL accessible?
3. [ ] Is the remote name correct in the import?
4. [ ] Are shared dependencies configured correctly?

**Debug:**

```bash
# Check manifest
curl https://your-app.zephyr-cloud.io/zephyr-manifest.json | jq '.dependencies.auth'

# Check remote entry is accessible
curl -I https://cdn.zephyr.io/auth/v1.0.0/remoteEntry.js
```

### OTA Update Not Detected

**Symptoms:** New version deployed but app doesn't show update

**Checklist:**

1. [ ] Is `applicationUid` correct?
2. [ ] Is OTA Worker started?
3. [ ] Is runtime plugin connected?
4. [ ] Is `checkInterval` too long?

**Debug:**

```typescript
// Check OTA status
console.log('OTA Metrics:', otaWorker.getMetrics());
console.log('Runtime Plugin:', global.__ZEPHYR_RUNTIME_PLUGIN_INSTANCE__);
```

### Manifest Refresh Not Working

**Symptoms:** Update applied but old remote still loads

**Checklist:**

1. [ ] Is runtime plugin connected to OTA Worker?
2. [ ] Is `refresh()` being called?
3. [ ] Is there caching interfering?

**Fix:**

```typescript
// Ensure runtime plugin is connected
if (global.__ZEPHYR_RUNTIME_PLUGIN_INSTANCE__) {
  otaWorker.setRuntimePlugin(global.__ZEPHYR_RUNTIME_PLUGIN_INSTANCE__);
}

// Force refresh
await global.__ZEPHYR_RUNTIME_PLUGIN_INSTANCE__.refresh();
```

### Bundle Download Failures

**Symptoms:** Pre-download fails, bundles not cached

**Checklist:**

1. [ ] Is there network connectivity?
2. [ ] Is storage permission granted?
3. [ ] Is cache directory writable?
4. [ ] Is device storage full?

**Debug:**

```typescript
const stats = downloadManager.getStats();
console.log('Download stats:', stats);

const cacheMetrics = cacheManager.getMetrics();
console.log('Cache metrics:', cacheMetrics);
```

---

## Summary

Module Federation + OTA enables true "apps inside your app" architecture:

| Feature                    | Benefit                                 |
| -------------------------- | --------------------------------------- |
| **Independent Deployment** | Update remotes without host app changes |
| **Instant Updates**        | No app store review required            |
| **Per-Module Rollback**    | Revert specific features independently  |
| **Lazy Loading**           | Smaller initial bundle, faster startup  |
| **Team Autonomy**          | Different teams own different remotes   |
| **Offline Support**        | Cached bundles work without network     |

**Reading Order:**

1. [QA_GUIDE_SETUP.md](./QA_GUIDE_SETUP.md) - Initial app setup
2. [OTA_SETUP.md](./OTA_SETUP.md) - OTA configuration reference
3. This guide - Module Federation + OTA integration
4. [QA_GUIDE_OTA.md](./QA_GUIDE_OTA.md) - Testing workflows

---

## Resources

- [Zephyr Documentation](https://docs.zephyr-cloud.io)
- [Module Federation Docs](https://module-federation.io)
- [React Native Metro](https://facebook.github.io/metro/)
- [Discord Community](https://zephyr-cloud.io/discord)
- [GitHub Issues](https://github.com/ZephyrCloudIO/zephyr-packages/issues)
