# zephyr-ota-plugin

OTA (Over-The-Air) update plugin for React Native applications using Zephyr Cloud Module Federation.

## Features

- **Auto-detection** of remotes from Module Federation runtime
- Automatic update detection for Module Federation remotes
- Version tracking using Zephyr Cloud's snapshot IDs
- Configurable periodic and foreground update checks
- React hooks for easy integration
- Full app reload to apply updates
- Dismiss/snooze functionality
- Per-remote environment overrides

## Installation

```bash
npm install zephyr-ota-plugin
# or
yarn add zephyr-ota-plugin
# or
pnpm add zephyr-ota-plugin
```

### Peer Dependencies

Make sure you have these peer dependencies installed:

```bash
npm install react react-native @react-native-async-storage/async-storage
```

## Quick Start

### 1. Wrap your app with the provider

The simplest setup - just specify your target environment and the plugin automatically detects your remotes from the Module Federation runtime:

```tsx
import { ZephyrOTAProvider } from 'zephyr-ota-plugin';

function App() {
  return (
    <ZephyrOTAProvider environment="staging">
      <MainApp />
    </ZephyrOTAProvider>
  );
}
```

**With configuration options:**

```tsx
<ZephyrOTAProvider
  environment="staging"
  config={{
    checkOnForeground: true,
    enablePeriodicChecks: true,
    debug: __DEV__,
  }}
  onUpdateAvailable={(updates) => console.log('Updates:', updates)}
>
  <MainApp />
</ZephyrOTAProvider>
```

**With per-remote environment overrides:**

```tsx
<ZephyrOTAProvider
  environment="staging"
  overrides={{ MFTextEditor: 'production' }} // Use production for this remote
>
  <MainApp />
</ZephyrOTAProvider>
```

### 2. Use the hook to show updates

```tsx
import { useZephyrOTA } from 'zephyr-ota-plugin';

function UpdateBanner() {
  const { hasUpdates, updates, applyUpdates, dismissUpdates, isChecking } = useZephyrOTA();

  if (isChecking) {
    return <ActivityIndicator />;
  }

  if (!hasUpdates) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text>Updates available for: {updates.map((u) => u.name).join(', ')}</Text>
      <View style={styles.buttons}>
        <Button onPress={applyUpdates} title="Update Now" />
        <Button onPress={dismissUpdates} title="Later" />
      </View>
    </View>
  );
}
```

## Configuration

### ZephyrOTAConfig

| Property               | Type      | Default                           | Description                                 |
| ---------------------- | --------- | --------------------------------- | ------------------------------------------- |
| `authToken`            | `string`  | `''`                              | Auth token for private applications         |
| `apiBaseUrl`           | `string`  | `'https://zeapi.zephyrcloud.app'` | Zephyr Cloud API base URL                   |
| `checkInterval`        | `number`  | `1800000` (30 min)                | Periodic check interval in ms               |
| `minCheckInterval`     | `number`  | `300000` (5 min)                  | Minimum time between checks (rate limiting) |
| `dismissDuration`      | `number`  | `3600000` (1 hour)                | How long to suppress prompts after dismiss  |
| `checkOnForeground`    | `boolean` | `true`                            | Check when app comes to foreground          |
| `enablePeriodicChecks` | `boolean` | `true`                            | Enable periodic background checks           |
| `debug`                | `boolean` | `false`                           | Enable debug logging                        |

## Auto-Detection

The plugin automatically detects remotes from the Module Federation runtime. When you specify the `environment` prop, the plugin:

1. Reads the remotes configuration from `@module-federation/runtime`
2. Filters for remotes using the `zephyr:` protocol
3. Extracts the application UID (e.g., `mftexteditor.myproject.myorg`)
4. Builds OTA tracking configuration using your target environment

This means you don't need to duplicate your remotes configuration - just specify which environment to track.

### Per-Remote Environment Overrides

Use the `overrides` prop when you need different environments for specific remotes:

```tsx
<ZephyrOTAProvider
  environment="staging"           // Default environment for all remotes
  overrides={{
    MFTextEditor: 'production',   // Use production for MFTextEditor
    MFNotesList: 'canary',        // Use canary for MFNotesList
  }}
>
```

### Legacy Manual Configuration

If auto-detection doesn't work for your setup, you can manually specify dependencies:

```typescript
const dependencies = {
  RemoteName: 'zephyr:appName.projectName.orgName@environment',
};

<ZephyrOTAProvider dependencies={dependencies}>
```

The format matches the remotes defined in your metro.config.js.

## API Reference

### Hooks

#### `useZephyrOTA()`

Main hook with full functionality:

```typescript
const {
  // State
  isChecking, // boolean - update check in progress
  hasUpdates, // boolean - updates available
  updates, // RemoteVersionInfo[] - remotes with updates
  remotes, // RemoteVersionInfo[] - all tracked remotes
  lastChecked, // Date | null - last check time
  error, // Error | null - any error

  // Actions
  checkForUpdates, // (options?: { force?: boolean }) => Promise<UpdateCheckResult>
  applyUpdates, // () => Promise<void> - applies updates and reloads app
  dismissUpdates, // () => Promise<void> - dismisses for configured duration
  getRemoteVersion, // (name: string) => RemoteVersionInfo | undefined
} = useZephyrOTA();
```

#### `useOTAStatus()`

Lightweight read-only hook:

```typescript
const {
  isChecking,
  hasUpdates,
  updateCount,
  updatedRemotes, // string[] - names of remotes with updates
  lastChecked,
  error,
} = useOTAStatus();
```

### Components

#### `<ZephyrOTAProvider>`

Props:

| Prop                | Type                                     | Required | Description                                                                 |
| ------------------- | ---------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `environment`       | `string`                                 | No\*     | Target environment (e.g., 'staging', 'production'). Enables auto-detection. |
| `overrides`         | `EnvironmentOverrides`                   | No       | Per-remote environment overrides                                            |
| `dependencies`      | `ZephyrDependencyConfig`                 | No\*     | Manual dependencies (legacy, use `environment` instead)                     |
| `config`            | `ZephyrOTAConfig`                        | No       | Configuration options                                                       |
| `onUpdateAvailable` | `(updates: RemoteVersionInfo[]) => void` | No       | Called when updates are detected                                            |
| `onUpdateApplied`   | `() => void`                             | No       | Called before app reload                                                    |
| `onError`           | `(error: Error) => void`                 | No       | Called on errors                                                            |

\*Either `environment` (recommended) or `dependencies` should be provided.

### Service (Advanced)

For non-React usage or custom implementations:

```typescript
import { ZephyrOTAService, createZephyrOTAService } from 'zephyr-ota-plugin';

const service = createZephyrOTAService(config, dependencies);

// Initialize on first launch
await service.initializeVersionTracking();

// Check for updates
const result = await service.checkForUpdates(true);

// Apply updates
if (result.hasUpdates) {
  await service.applyUpdates(result.remotes.filter((r) => r.hasUpdate));
}
```

## Types

```typescript
interface RemoteVersionInfo {
  name: string;
  currentVersion: string | null;
  latestVersion: string;
  remoteEntryUrl: string;
  hasUpdate: boolean;
  publishedAt?: number;
}

interface UpdateCheckResult {
  hasUpdates: boolean;
  remotes: RemoteVersionInfo[];
  timestamp: number;
}
```

## How It Works

1. **Version Detection**: The plugin uses Zephyr Cloud's `/resolve/` API to get remote URLs, then fetches `/__get_version_info__` to get the actual `snapshot_id` which changes with each deployment.

2. **Version Tracking**: On first launch, current versions are stored in AsyncStorage. Subsequent checks compare stored versions with resolved versions.

3. **Update Application**: When updates are applied, Module Federation caches are cleared and the app is reloaded using `DevSettings.reload()` to ensure fresh bundles are loaded.

## Integration with Metro Plugin

The OTA plugin works with remotes configured using the `zephyr:` protocol in your metro configuration:

```javascript
// metro.config.js
const { withZephyr } = require('zephyr-metro-plugin');

module.exports = withZephyr({
  remotes: {
    MFTextEditor: 'zephyr:mftexteditor.myproject.myorg@staging',
    MFNotesList: 'zephyr:mfnoteslist.myproject.myorg@staging',
  },
  // ... other config
})(getDefaultConfig(__dirname));
```

Use the same `remotes` object when configuring the OTA provider to ensure consistency.

## Debugging

Enable debug logging to see detailed information:

```typescript
<ZephyrOTAProvider
  config={{ debug: true }}
  // ...
>
```

Or programmatically:

```typescript
import { setDebugEnabled } from 'zephyr-ota-plugin';

setDebugEnabled(true);
```

## License

Apache-2.0
