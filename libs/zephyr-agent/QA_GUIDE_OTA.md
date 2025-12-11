# QA Guide: Testing OTA Updates with Zephyr

This step-by-step guide walks QA team members through testing Over-The-Air (OTA) updates in a React Native application using Zephyr.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Understanding OTA Updates](#understanding-ota-updates)
3. [Setting Up OTA in Your App](#setting-up-ota-in-your-app)
4. [Testing Workflow](#testing-workflow)
5. [Test Scenarios](#test-scenarios)
6. [Verifying Updates](#verifying-updates)
7. [Debugging OTA Issues](#debugging-ota-issues)
8. [Test Checklist](#test-checklist)

---

## Prerequisites

Before testing OTA updates, ensure you have:

- A React Native app already set up and published to Zephyr (see [QA_GUIDE_SETUP.md](./QA_GUIDE_SETUP.md))
- Your **Application UID** from the Zephyr dashboard
- Your **Deployment URL** (e.g., `https://your-app.zephyr-cloud.io`)
- A physical device or simulator/emulator for testing
- Debug logging enabled in the app

---

## Understanding OTA Updates

### What is an OTA Update?

OTA (Over-The-Air) updates allow you to push JavaScript bundle changes to users **without** requiring them to download a new app from the App Store or Play Store.

### How Zephyr OTA Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Your App      │────▶│  Zephyr Cloud   │────▶│   New Bundle    │
│  (checks for    │     │  (version info) │     │   (downloaded)  │
│   updates)      │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        │                                               │
        ▼                                               ▼
┌─────────────────┐                           ┌─────────────────┐
│  No Update      │                           │  Update Applied │
│  (continue)     │                           │  (app refreshed)│
└─────────────────┘                           └─────────────────┘
```

### OTA Update Flow

1. **App starts** → OTA Worker begins
2. **Check for updates** → Polls Zephyr endpoint
3. **Update available?** → Compare versions
4. **Download manifest** → Get new bundle URLs
5. **Apply update** → Refresh runtime
6. **User sees changes** → Without app reinstall

---

## Setting Up OTA in Your App

### Step 1: Create OTA Service File

Create a new file `src/services/ZephyrOTA.ts`:

```typescript
import { ZephyrOTAWorker } from 'zephyr-agent';
import type { ZephyrOTAUpdate } from 'zephyr-agent';
import { Alert, Platform } from 'react-native';

// Configuration - UPDATE THESE VALUES
const APPLICATION_UID = 'YOUR_APPLICATION_UID'; // From Zephyr dashboard
const CHECK_INTERVAL = 1 * 60 * 1000; // Check every 1 minute (for testing)

// Create OTA Worker instance
export const otaWorker = new ZephyrOTAWorker(
  {
    applicationUid: APPLICATION_UID,
    platform: Platform.OS as 'ios' | 'android',
    checkInterval: CHECK_INTERVAL,
    debug: true, // Enable debug logging for QA
  },
  {
    // Called when update is available
    onUpdateAvailable: (update: ZephyrOTAUpdate) => {
      console.log('[OTA] Update available:', JSON.stringify(update, null, 2));

      // Show alert to user
      Alert.alert('Update Available', `Version ${update.version} is ready.\n\n${update.description || 'Bug fixes and improvements.'}`, [
        {
          text: 'Later',
          style: 'cancel',
          onPress: () => {
            console.log('[OTA] Update declined');
            otaWorker.declineUpdate(update.version);
          },
        },
        {
          text: 'Update Now',
          onPress: async () => {
            console.log('[OTA] Applying update...');
            try {
              await otaWorker.applyUpdate(update);
            } catch (error) {
              console.error('[OTA] Apply failed:', error);
              Alert.alert('Update Failed', 'Please try again later.');
            }
          },
        },
      ]);
    },

    // Called when check fails
    onUpdateError: (error: Error) => {
      console.error('[OTA] Update check error:', error.message);
    },

    // Called when update applied successfully
    onUpdateApplied: (version: string) => {
      console.log('[OTA] Update applied successfully:', version);
      Alert.alert('Update Complete', `Now running version ${version}`);
    },

    // Called when update fails to apply
    onUpdateFailed: (error: Error) => {
      console.error('[OTA] Update failed:', error.message);
      Alert.alert('Update Failed', error.message);
    },
  }
);

// Helper to manually trigger update check
export const checkForUpdates = async () => {
  console.log('[OTA] Manual update check triggered');
  // The worker handles the check internally
};

// Helper to get current metrics
export const getOTAMetrics = () => {
  const metrics = otaWorker.getMetrics();
  console.log('[OTA] Current metrics:', JSON.stringify(metrics, null, 2));
  return metrics;
};
```

### Step 2: Update App.tsx

Modify your `App.tsx` to initialize OTA:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { otaWorker, getOTAMetrics } from './services/ZephyrOTA';

// UPDATE THIS VERSION when making changes
const APP_VERSION = '1.0.0';

function App(): React.JSX.Element {
  const [metrics, setMetrics] = useState<any>(null);
  const [lastCheck, setLastCheck] = useState<string>('Never');

  useEffect(() => {
    // Start OTA Worker
    console.log('[App] Starting OTA Worker...');
    otaWorker.start();

    // Update metrics every 10 seconds
    const metricsInterval = setInterval(() => {
      const m = getOTAMetrics();
      setMetrics(m);
      if (m.lastCheckTimestamp) {
        setLastCheck(new Date(m.lastCheckTimestamp).toLocaleTimeString());
      }
    }, 10000);

    return () => {
      console.log('[App] Stopping OTA Worker...');
      otaWorker.stop();
      clearInterval(metricsInterval);
    };
  }, []);

  const handleManualCheck = () => {
    console.log('[App] Manual check requested');
    // Restart worker to trigger immediate check
    otaWorker.stop();
    otaWorker.start();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Zephyr OTA Test App</Text>
        <Text style={styles.version}>Version: {APP_VERSION}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>OTA Status</Text>
        <Text style={styles.info}>Last Check: {lastCheck}</Text>
        <Text style={styles.info}>Checks Performed: {metrics?.checksPerformed || 0}</Text>
        <Text style={styles.info}>Updates Available: {metrics?.updatesAvailable || 0}</Text>
        <Text style={styles.info}>Updates Applied: {metrics?.updatesApplied || 0}</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleManualCheck}>
        <Text style={styles.buttonText}>Check for Updates</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Instructions</Text>
        <Text style={styles.instruction}>1. Note the current version above</Text>
        <Text style={styles.instruction}>2. Make a code change and republish</Text>
        <Text style={styles.instruction}>3. Wait for update notification</Text>
        <Text style={styles.instruction}>4. Tap "Update Now" to apply</Text>
        <Text style={styles.instruction}>5. Verify the version changed</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  version: {
    fontSize: 18,
    color: '#007AFF',
    marginTop: 5,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  info: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  instruction: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    paddingLeft: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;
```

### Step 3: Build and Deploy Initial Version

```bash
# Build and deploy for iOS
PLATFORM=ios NODE_ENV=production npm run build:ios

# Or for Android
PLATFORM=android NODE_ENV=production npm run build:android
```

---

## Testing Workflow

### Complete OTA Testing Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    OTA TESTING WORKFLOW                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. INITIAL SETUP                                                │
│     ├── Deploy Version 1.0.0                                     │
│     ├── Install app on device                                    │
│     └── Verify app shows "Version 1.0.0"                         │
│                                                                  │
│  2. MAKE CODE CHANGE                                             │
│     ├── Edit App.tsx (change version to 1.0.1)                   │
│     ├── Commit changes                                           │
│     └── Deploy new version                                       │
│                                                                  │
│  3. WAIT FOR UPDATE                                              │
│     ├── App checks for updates (every 1 min in test mode)        │
│     ├── Update dialog appears                                    │
│     └── Review update information                                │
│                                                                  │
│  4. APPLY UPDATE                                                 │
│     ├── Tap "Update Now"                                         │
│     ├── Wait for update to apply                                 │
│     └── Verify success message                                   │
│                                                                  │
│  5. VERIFY                                                       │
│     ├── Check version shows "1.0.1"                              │
│     ├── Verify UI changes are visible                            │
│     └── Check metrics updated                                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Testing

#### Step 1: Deploy Initial Version

```bash
# Make sure App.tsx shows version 1.0.0
const APP_VERSION = '1.0.0';

# Build and deploy
PLATFORM=ios NODE_ENV=production npm run build:ios
```

#### Step 2: Install on Device/Simulator

**For iOS Simulator:**

```bash
npm run ios
```

**For Android Emulator:**

```bash
npm run android
```

**For Physical Device:**

- Use Xcode or Android Studio to install
- Or use development builds

#### Step 3: Verify Initial State

On the app, verify:

- [ ] Version shows "1.0.0"
- [ ] OTA Status section is visible
- [ ] "Check for Updates" button works
- [ ] Console shows `[OTA] Starting...` logs

#### Step 4: Make a Code Change

Edit `App.tsx`:

```typescript
// Change version number
const APP_VERSION = '1.0.1';

// Optional: Add visible UI change
<Text style={styles.version}>Version: {APP_VERSION} (Updated!)</Text>
```

#### Step 5: Deploy Updated Version

```bash
# Commit changes
git add .
git commit -m "Bump version to 1.0.1 for OTA test"

# Deploy
PLATFORM=ios NODE_ENV=production npm run build:ios
```

#### Step 6: Wait for Update Detection

- Keep the app open
- Wait for update check (1 minute interval in test mode)
- Or tap "Check for Updates" button

**Expected:** Alert dialog appears with "Update Available"

#### Step 7: Apply the Update

1. Tap "Update Now" in the alert
2. Wait for update to complete
3. Success alert should appear

**Expected:** Version changes to "1.0.1"

---

## Test Scenarios

### Scenario 1: Happy Path - Successful Update

| Step | Action           | Expected Result          |
| ---- | ---------------- | ------------------------ |
| 1    | App is on v1.0.0 | Version displays "1.0.0" |
| 2    | Deploy v1.0.1    | Deployment succeeds      |
| 3    | Wait for check   | Update dialog appears    |
| 4    | Tap "Update Now" | Loading indicator shows  |
| 5    | Update completes | Success alert shows      |
| 6    | Verify version   | Shows "1.0.1"            |

### Scenario 2: Decline Update

| Step | Action           | Expected Result                        |
| ---- | ---------------- | -------------------------------------- |
| 1    | Update available | Dialog shows                           |
| 2    | Tap "Later"      | Dialog dismisses                       |
| 3    | Check metrics    | "Updates Available" = 1, "Applied" = 0 |
| 4    | Next check cycle | Same update NOT shown again            |

### Scenario 3: Network Failure During Check

| Step | Action                | Expected Result     |
| ---- | --------------------- | ------------------- |
| 1    | Enable airplane mode  | No network          |
| 2    | Trigger check         | Console shows error |
| 3    | onUpdateError called  | Error logged        |
| 4    | Disable airplane mode | Next check succeeds |

### Scenario 4: Network Failure During Apply

| Step | Action                | Expected Result   |
| ---- | --------------------- | ----------------- |
| 1    | Update available      | Dialog shows      |
| 2    | Enable airplane mode  | No network        |
| 3    | Tap "Update Now"      | Error alert shows |
| 4    | onUpdateFailed called | Error logged      |
| 5    | Disable airplane mode | Can retry update  |

### Scenario 5: App Background/Foreground

| Step | Action                  | Expected Result            |
| ---- | ----------------------- | -------------------------- |
| 1    | App in foreground       | Checks run normally        |
| 2    | Send app to background  | Checks pause               |
| 3    | Bring app to foreground | Check triggers immediately |

### Scenario 6: Critical/Mandatory Update

| Step | Action                       | Expected Result                |
| ---- | ---------------------------- | ------------------------------ |
| 1    | Deploy with `critical: true` | Update marked critical         |
| 2    | Update check occurs          | Dialog shows (non-dismissible) |
| 3    | Only "Update Now" option     | No "Later" button              |

### Scenario 7: Multiple Updates

| Step | Action                                 | Expected Result         |
| ---- | -------------------------------------- | ----------------------- |
| 1    | App on v1.0.0                          | Initial state           |
| 2    | Deploy v1.0.1                          | First update available  |
| 3    | Deploy v1.0.2 (without applying 1.0.1) | Latest version shown    |
| 4    | Apply update                           | Goes directly to v1.0.2 |

---

## Verifying Updates

### Check Console Logs

Enable debug mode and look for these logs:

```
[ZephyrOTA] OTA Worker initialized
[ZephyrOTA] Starting OTA Worker
[ZephyrOTA] Checking for updates...
[ZephyrOTA] Update available { version: "1.0.1", ... }
[ZephyrOTA] Applying update...
[ZephyrOTA] Update applied successfully
```

### Check Metrics

Use the app's metrics display or console:

```javascript
// In console or app
{
  checksPerformed: 5,
  updatesAvailable: 1,
  updatesApplied: 1,
  updatesFailed: 0,
  lastCheckTimestamp: 1699900000000,
  lastUpdateTimestamp: 1699900100000
}
```

### Verify Manifest

Check the manifest endpoint directly:

```bash
curl https://your-app.zephyr-cloud.io/zephyr-manifest.json
```

Should return:

```json
{
  "version": "1.0.1",
  "timestamp": "2024-01-15T10:30:00Z",
  ...
}
```

### Check Zephyr Dashboard

1. Go to [dashboard.zephyr-cloud.io](https://dashboard.zephyr-cloud.io)
2. Navigate to your app
3. Check deployment history
4. Verify latest version is active

---

## Debugging OTA Issues

### Issue: No Update Dialog Appears

**Checklist:**

1. [ ] Is `applicationUid` correct?
2. [ ] Is the new version actually deployed?
3. [ ] Is debug mode enabled? Check console logs
4. [ ] Is the check interval too long?
5. [ ] Did you decline this version before?

**Debug Steps:**

```bash
# Check deployment status
npx zephyr status

# Verify manifest
curl https://your-app.zephyr-cloud.io/zephyr-manifest.json

# Check app logs for errors
# Look for [ZephyrOTA] entries
```

### Issue: Update Fails to Apply

**Checklist:**

1. [ ] Is runtime plugin connected?
2. [ ] Is network stable?
3. [ ] Check console for specific error

**Debug Steps:**

```typescript
// Add more logging
onUpdateFailed: (error: Error) => {
  console.error('[OTA] Full error:', error);
  console.error('[OTA] Stack:', error.stack);
};
```

### Issue: Wrong Version After Update

**Checklist:**

1. [ ] Did you change the version constant in code?
2. [ ] Did you rebuild and redeploy?
3. [ ] Is there caching involved?

**Debug Steps:**

```bash
# Clear Metro cache
npm start -- --reset-cache

# Rebuild
PLATFORM=ios NODE_ENV=production npm run build:ios
```

### Issue: Updates Check Too Frequently/Infrequently

**Solution:** Adjust `checkInterval`:

```typescript
const config = {
  checkInterval: 5 * 60 * 1000, // 5 minutes for QA
  // Production: 30 * 60 * 1000   // 30 minutes
};
```

### Reading Debug Logs

| Log Level | Prefix               | Meaning                         |
| --------- | -------------------- | ------------------------------- |
| Info      | `[ZephyrOTA]`        | Normal operation                |
| Error     | `[ZephyrOTA] Error:` | Something failed                |
| Debug     | `[ZephyrOTA] Debug:` | Detailed info (debug mode only) |

---

## Test Checklist

Use this checklist for comprehensive OTA testing:

### Initial Setup

- [ ] App installed with initial version
- [ ] OTA service initialized correctly
- [ ] Debug logging enabled
- [ ] Can see OTA status in app

### Update Detection

- [ ] Automatic check works (waits for interval)
- [ ] Manual check button works
- [ ] Update dialog shows correct version
- [ ] Update dialog shows description/release notes
- [ ] Critical updates show as mandatory

### Update Application

- [ ] "Update Now" starts the process
- [ ] Progress indicator shows (if implemented)
- [ ] Success message appears
- [ ] Version number updates in UI
- [ ] UI changes are visible

### Decline Flow

- [ ] "Later" dismisses dialog
- [ ] Declined updates not shown again
- [ ] Can still manually check later

### Error Handling

- [ ] Network error shows appropriate message
- [ ] Apply failure shows error
- [ ] App remains functional after error

### Edge Cases

- [ ] Background/foreground transition
- [ ] Multiple rapid deployments
- [ ] Large bundle updates
- [ ] Low storage scenarios (Android)

### Metrics

- [ ] Checks performed count increases
- [ ] Updates available count is accurate
- [ ] Updates applied count after success
- [ ] Timestamps are correct

---

## Quick Commands Reference

| Action              | Command                                                      |
| ------------------- | ------------------------------------------------------------ | --------------- |
| Build iOS           | `PLATFORM=ios NODE_ENV=production npm run build:ios`         |
| Build Android       | `PLATFORM=android NODE_ENV=production npm run build:android` |
| Run iOS             | `npm run ios`                                                |
| Run Android         | `npm run android`                                            |
| Clear cache         | `npm start -- --reset-cache`                                 |
| Check manifest      | `curl https://your-app.zephyr-cloud.io/zephyr-manifest.json` |
| View logs (iOS)     | Xcode Console or `npx react-native log-ios`                  |
| View logs (Android) | `adb logcat                                                  | grep -i zephyr` |

---

## Support

If you encounter issues:

1. **Check Logs** - Enable debug mode and review console
2. **Check Dashboard** - Verify deployment status on Zephyr Cloud
3. **Check Network** - Ensure device has internet access
4. **Ask Team** - Reach out on Slack/Discord

**Resources:**

- [Zephyr Documentation](https://docs.zephyr-cloud.io)
- [Discord Community](https://zephyr-cloud.io/discord)
- [GitHub Issues](https://github.com/ZephyrCloudIO/zephyr-packages/issues)
