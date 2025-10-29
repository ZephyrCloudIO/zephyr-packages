# Zephyr OTA (Over-The-Air) Updates for Metro + React Native

This guide explains how to implement OTA updates in your React Native application using Zephyr with Metro bundler.

## Overview

Over-The-Air (OTA) updates allow you to deploy updates to your React Native application without going through the App Store or Play Store review process. With Zephyr's Metro plugin, you can:

- Deploy JavaScript and asset updates instantly
- Roll back to previous versions if needed
- Target specific user segments
- Test updates with a subset of users before full rollout
- Support platform-specific updates (iOS/Android)

## Configuration

To enable OTA support in your React Native app using Metro, configure your `metro.config.js`:

```javascript
const { withZephyr } = require('zephyr-metro-plugin');

const mfConfig = {
  name: 'MyApp',
  remotes: {
    // Your remote dependencies
    'shared-components': 'https://your-cdn.com/shared-components',
  },
  shared: {
    react: {
      singleton: true,
      eager: true,
    },
    'react-native': {
      singleton: true,
      eager: true,
    },
  },
};

// Platform can be 'ios' or 'android'
const platform = process.env.PLATFORM || 'ios';
const mode = process.env.NODE_ENV || 'production';

module.exports = withZephyr(__dirname, platform, mode, 'dist')(mfConfig);
```

## Runtime Implementation

Since Metro has a different architecture than webpack-based bundlers, the OTA implementation for Metro requires setup in your React Native application.

### 1. OTA Service Setup

Create an OTA service to handle update checks and management:

```typescript
// src/services/ZephyrOTAService.ts
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OTAConfig {
  applicationUid: string;
  checkInterval?: number; // in milliseconds
  debug?: boolean;
  otaEndpoint?: string;
  manifestUrl?: string;
}

interface OTAUpdate {
  version: string;
  manifestUrl: string;
  updateAvailable: boolean;
  mandatory?: boolean;
}

export class ZephyrOTAService {
  private config: OTAConfig;
  private checkIntervalId?: NodeJS.Timeout;
  private appStateSubscription?: any;

  constructor(config: OTAConfig) {
    this.config = {
      checkInterval: 30 * 60 * 1000, // Default: 30 minutes
      debug: false,
      ...config,
    };
  }

  /** Initialize the OTA service */
  async initialize() {
    if (this.config.debug) {
      console.log('[Zephyr OTA] Initializing OTA service');
    }

    // Check for updates immediately
    await this.checkForUpdates();

    // Set up periodic update checks
    this.startPeriodicChecks();

    // Check for updates when app comes to foreground
    this.setupAppStateListener();
  }

  /** Check for available updates */
  private async checkForUpdates(): Promise<OTAUpdate | null> {
    try {
      if (this.config.debug) {
        console.log('[Zephyr OTA] Checking for updates...');
      }

      const currentVersion = await this.getCurrentVersion();
      const endpoint = this.config.otaEndpoint || `https://api.zephyr-cloud.io/ota/check/${this.config.applicationUid}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentVersion,
          platform: Platform.OS,
        }),
      });

      if (!response.ok) {
        throw new Error(`OTA check failed: ${response.statusText}`);
      }

      const update: OTAUpdate = await response.json();

      if (update.updateAvailable) {
        if (this.config.debug) {
          console.log('[Zephyr OTA] Update available:', update.version);
        }
        await this.handleUpdate(update);
      }

      return update;
    } catch (error) {
      console.error('[Zephyr OTA] Error checking for updates:', error);
      return null;
    }
  }

  /** Handle available update */
  private async handleUpdate(update: OTAUpdate) {
    if (update.mandatory) {
      // Force update for mandatory updates
      await this.applyUpdate(update);
    } else {
      // Store update info and notify user
      await AsyncStorage.setItem('zephyr_pending_update', JSON.stringify(update));
      // You can emit an event here to show a custom update UI
    }
  }

  /** Apply the OTA update */
  private async applyUpdate(update: OTAUpdate) {
    try {
      if (this.config.debug) {
        console.log('[Zephyr OTA] Applying update:', update.version);
      }

      // Download the new manifest
      const manifestResponse = await fetch(update.manifestUrl);
      const manifest = await manifestResponse.json();

      // Store the new manifest
      await AsyncStorage.setItem('zephyr_manifest', JSON.stringify(manifest));
      await AsyncStorage.setItem('zephyr_version', update.version);

      // Trigger app reload
      if (this.config.debug) {
        console.log('[Zephyr OTA] Update applied successfully');
      }

      // You might want to show a message before reloading
      // RNRestart.Restart(); // If using react-native-restart
    } catch (error) {
      console.error('[Zephyr OTA] Error applying update:', error);
      throw error;
    }
  }

  /** Get current version */
  private async getCurrentVersion(): Promise<string> {
    try {
      const version = await AsyncStorage.getItem('zephyr_version');
      return version || '1.0.0';
    } catch (error) {
      return '1.0.0';
    }
  }

  /** Start periodic update checks */
  private startPeriodicChecks() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
    }

    this.checkIntervalId = setInterval(() => {
      this.checkForUpdates();
    }, this.config.checkInterval);
  }

  /** Setup app state listener for foreground checks */
  private setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        this.checkForUpdates();
      }
    });
  }

  /** Clean up resources */
  destroy() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
  }
}
```

### 2. Initialize in Your App

```typescript
// App.tsx
import React, { useEffect } from 'react';
import { ZephyrOTAService } from './services/ZephyrOTAService';

const otaService = new ZephyrOTAService({
  applicationUid: 'your-app-uid',
  checkInterval: 30 * 60 * 1000, // 30 minutes
  debug: __DEV__,
});

export default function App() {
  useEffect(() => {
    otaService.initialize();

    return () => {
      otaService.destroy();
    };
  }, []);

  return (
    // Your app components
  );
}
```

## Update Strategies

### 1. Silent Updates

Updates are downloaded and applied in the background:

```typescript
const otaService = new ZephyrOTAService({
  applicationUid: 'your-app-uid',
  checkInterval: 15 * 60 * 1000, // Check every 15 minutes
  autoApply: true, // Apply updates automatically
});
```

### 2. User-Prompted Updates

Show a dialog to users when updates are available:

```typescript
// Emit event when update is available
const handleUpdate = async (update: OTAUpdate) => {
  Alert.alert('Update Available', `Version ${update.version} is available. Would you like to update now?`, [
    {
      text: 'Later',
      style: 'cancel',
    },
    {
      text: 'Update',
      onPress: () => applyUpdate(update),
    },
  ]);
};
```

### 3. Mandatory Updates

Force updates for critical fixes:

```typescript
if (update.mandatory) {
  Alert.alert(
    'Required Update',
    'A critical update is required to continue using the app.',
    [
      {
        text: 'Update Now',
        onPress: () => applyUpdate(update),
      },
    ],
    { cancelable: false }
  );
}
```

## Platform-Specific Updates

Handle iOS and Android separately:

```typescript
const platform = Platform.OS;

const otaConfig = {
  applicationUid: platform === 'ios' ? 'your-app-uid-ios' : 'your-app-uid-android',
  manifestUrl: `https://your-cdn.com/${platform}/manifest.json`,
};
```

## Rollback Strategy

Implement rollback capability:

```typescript
async function rollbackToPreviousVersion() {
  try {
    const previousManifest = await AsyncStorage.getItem('zephyr_manifest_backup');
    if (previousManifest) {
      await AsyncStorage.setItem('zephyr_manifest', previousManifest);
      // Trigger app reload
    }
  } catch (error) {
    console.error('Rollback failed:', error);
  }
}
```

## Testing

### Test OTA Updates

1. **Development Testing:**

```bash
# Build with test OTA endpoint
ZEPHYR_OTA_ENDPOINT=https://staging.api.zephyr-cloud.io npm run build:ios
```

2. **Staged Rollout:**

   - Deploy to a small percentage of users first
   - Monitor for errors
   - Gradually increase rollout percentage

3. **A/B Testing:**
   - Deploy different versions to different user segments
   - Compare metrics
   - Roll out the winning version

## Best Practices

1. **Always test updates thoroughly** before deploying to production
2. **Keep bundle sizes small** for faster downloads
3. **Implement proper error handling** and rollback mechanisms
4. **Version your updates** consistently
5. **Monitor update success rates** and user feedback
6. **Use mandatory updates** sparingly, only for critical fixes
7. **Provide offline support** - app should work if update fails
8. **Cache updates** locally to avoid re-downloading

## Monitoring

Track OTA update metrics:

```typescript
// Log update events
analytics.track('ota_update_checked', {
  currentVersion,
  updateAvailable: update.updateAvailable,
});

analytics.track('ota_update_applied', {
  fromVersion: currentVersion,
  toVersion: update.version,
  platform: Platform.OS,
});
```

## Troubleshooting

### Updates Not Applying

1. Check network connectivity
2. Verify manifest URL is accessible
3. Check AsyncStorage permissions
4. Review error logs

### App Crashes After Update

1. Implement rollback mechanism
2. Test updates in staging first
3. Use feature flags for gradual rollout
4. Monitor crash reports

### Slow Update Downloads

1. Optimize bundle size
2. Use CDN with good geographic coverage
3. Implement delta updates (only changed files)
4. Compress assets

## Security Considerations

1. **Sign your updates** to prevent tampering
2. **Use HTTPS** for all OTA communications
3. **Validate manifests** before applying
4. **Implement update authentication**
5. **Monitor for suspicious activity**

## Resources

- [Zephyr Documentation](https://docs.zephyr-cloud.io)
- [React Native OTA Best Practices](https://docs.zephyr-cloud.io/guides/ota-best-practices)
- [Module Federation with React Native](https://docs.zephyr-cloud.io/guides/module-federation)

## Support

For OTA-related questions or issues:

- [Discord Community](https://zephyr-cloud.io/discord)
- [GitHub Issues](https://github.com/ZephyrCloudIO/zephyr-packages/issues)
- [Documentation](https://docs.zephyr-cloud.io)
