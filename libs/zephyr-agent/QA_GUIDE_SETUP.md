# QA Guide: React Native App Setup & Publishing with Zephyr

This step-by-step guide walks QA team members through setting up a React Native application from scratch and publishing it to Zephyr Cloud.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Create a New React Native App](#create-a-new-react-native-app)
4. [Install Zephyr Dependencies](#install-zephyr-dependencies)
5. [Configure Zephyr Metro Plugin](#configure-zephyr-metro-plugin)
6. [Authenticate with Zephyr Cloud](#authenticate-with-zephyr-cloud)
7. [Build and Publish](#build-and-publish)
8. [Verify Deployment](#verify-deployment)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have the following installed on your machine:

| Tool           | Minimum Version | Check Command     | Install Guide                                                 |
| -------------- | --------------- | ----------------- | ------------------------------------------------------------- |
| Node.js        | 18.x            | `node --version`  | [nodejs.org](https://nodejs.org)                              |
| npm/yarn/pnpm  | Latest          | `npm --version`   | Comes with Node.js                                            |
| Git            | Any             | `git --version`   | [git-scm.com](https://git-scm.com)                            |
| Xcode          | 14+ (macOS)     | `xcode-select -p` | Mac App Store                                                 |
| Android Studio | Latest          | -                 | [developer.android.com](https://developer.android.com/studio) |
| CocoaPods      | Latest (macOS)  | `pod --version`   | `sudo gem install cocoapods`                                  |

### Zephyr Cloud Account

1. Go to [zephyr-cloud.io](https://zephyr-cloud.io)
2. Click **Sign Up** or **Login with GitHub**
3. Complete the registration process
4. Note your organization name from the dashboard

---

## Environment Setup

### Step 1: Verify Node.js Installation

```bash
node --version
# Should output: v18.x.x or higher

npm --version
# Should output: 9.x.x or higher
```

### Step 2: Install React Native CLI (if not installed)

```bash
npm install -g react-native-cli
```

### Step 3: Set Up iOS Environment (macOS only)

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install CocoaPods
sudo gem install cocoapods

# Verify
pod --version
```

### Step 4: Set Up Android Environment

1. Install Android Studio from [developer.android.com/studio](https://developer.android.com/studio)
2. During installation, ensure these are selected:
   - Android SDK
   - Android SDK Platform
   - Android Virtual Device
3. Add to your shell profile (`~/.bashrc`, `~/.zshrc`):

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

4. Reload your shell:

```bash
source ~/.zshrc  # or ~/.bashrc
```

---

## Create a New React Native App

### Step 1: Create the Project

```bash
# Navigate to your projects directory
cd ~/Projects

# Create a new React Native app
npx react-native@latest init ZephyrQATestApp

# Navigate into the project
cd ZephyrQATestApp
```

### Step 2: Verify the App Runs

**For iOS (macOS only):**

```bash
# Install iOS dependencies
cd ios && pod install && cd ..

# Run on iOS Simulator
npm run ios
```

**For Android:**

```bash
# Start Android emulator first (from Android Studio)
# Then run the app
npm run android
```

You should see the default React Native welcome screen.

### Step 3: Initialize Git Repository

```bash
# Initialize git (if not already done)
git init

# Add remote origin (replace with your repo URL)
git remote add origin https://github.com/YOUR_ORG/ZephyrQATestApp.git

# Make initial commit
git add .
git commit -m "Initial React Native app setup"
```

---

## Install Zephyr Dependencies

### Step 1: Install Required Packages

```bash
# Install Zephyr Metro Plugin
npm install --save-dev zephyr-metro-plugin

# Install AsyncStorage (required for OTA)
npm install @react-native-async-storage/async-storage

# Install NetInfo (optional, for network-aware downloads)
npm install @react-native-community/netinfo
```

### Step 2: Install iOS Pods (macOS only)

```bash
cd ios && pod install && cd ..
```

### Step 3: Verify Installation

```bash
# Check packages are installed
npm list zephyr-metro-plugin
npm list @react-native-async-storage/async-storage
```

---

## Configure Zephyr Metro Plugin

### Step 1: Update metro.config.js

Open `metro.config.js` in your project root and replace its contents:

```javascript
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withZephyr } = require('zephyr-metro-plugin');

const baseConfig = getDefaultConfig(__dirname);

// Get platform from environment variable (default: ios)
const platform = process.env.PLATFORM || 'ios';

module.exports = (async () => {
  const zephyrConfig = await withZephyr({
    name: 'ZephyrQATestApp', // Your app name
    target: platform, // 'ios' or 'android'
  })(baseConfig);

  return mergeConfig(baseConfig, zephyrConfig);
})();
```

### Step 2: Update package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "ios": "react-native run-ios",
    "android": "react-native run-android",
    "build:ios": "PLATFORM=ios NODE_ENV=production react-native bundle --platform ios --dev false --entry-file index.js --bundle-output ios/main.jsbundle --assets-dest ios",
    "build:android": "PLATFORM=android NODE_ENV=production react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res",
    "deploy:ios": "PLATFORM=ios NODE_ENV=production npm run build:ios",
    "deploy:android": "PLATFORM=android NODE_ENV=production npm run build:android"
  }
}
```

---

## Authenticate with Zephyr Cloud

### Step 1: Install Zephyr CLI (if not installed globally)

```bash
npm install -g zephyr-cloud-cli
```

### Step 2: Login to Zephyr Cloud

```bash
npx zephyr login
```

This will:

1. Open your browser to the Zephyr login page
2. Ask you to authenticate with GitHub
3. Store your credentials locally

### Step 3: Verify Authentication

```bash
npx zephyr whoami
```

You should see your username and organization.

---

## Build and Publish

### Step 1: Build for iOS

```bash
# Set environment and build
PLATFORM=ios NODE_ENV=production npm run build:ios
```

**Expected Output:**

```
[Zephyr] Building for iOS...
[Zephyr] Uploading assets...
[Zephyr] Deployment complete!
[Zephyr] URL: https://your-app.zephyr-cloud.io
```

### Step 2: Build for Android

```bash
# Set environment and build
PLATFORM=android NODE_ENV=production npm run build:android
```

### Step 3: Note Your Deployment URL

After successful deployment, Zephyr will output:

- **Deployment URL**: `https://your-app-name.zephyr-cloud.io`
- **Application UID**: Used for OTA configuration
- **Version**: The deployed version identifier

**Save these values** - you'll need them for OTA testing.

---

## Verify Deployment

### Step 1: Check Zephyr Dashboard

1. Go to [dashboard.zephyr-cloud.io](https://dashboard.zephyr-cloud.io)
2. Navigate to your organization
3. Find your app in the projects list
4. Verify the deployment shows:
   - Status: **Active**
   - Platform: **iOS** or **Android**
   - Version: Your build version

### Step 2: Access Deployment URL

Open the deployment URL in your browser:

```
https://your-app-name.zephyr-cloud.io
```

You should see your app's manifest or a landing page.

### Step 3: Verify Manifest

Access the manifest directly:

```
https://your-app-name.zephyr-cloud.io/zephyr-manifest.json
```

You should see a JSON response with:

- `version`
- `timestamp`
- `remotes` (if using Module Federation)
- `dependencies`

---

## Making Changes and Republishing

### Step 1: Make a Code Change

Edit `App.tsx` to make a visible change:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

function App(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Zephyr QA Test App</Text>
      <Text style={styles.version}>Version 1.0.1</Text> {/* Change this */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  version: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
});

export default App;
```

### Step 2: Commit and Build

```bash
# Commit your changes
git add .
git commit -m "Update version to 1.0.1"

# Rebuild and deploy
PLATFORM=ios NODE_ENV=production npm run build:ios
```

### Step 3: Verify New Deployment

1. Check the Zephyr dashboard for the new version
2. Note the new **timestamp** in the deployment
3. The manifest URL will now serve the updated version

---

## Troubleshooting

### Authentication Issues

**Error: "Not authenticated"**

```bash
# Re-login to Zephyr
npx zephyr logout
npx zephyr login
```

**Error: "Token expired"**

```bash
# Refresh your token
npx zephyr login --refresh
```

### Build Failures

**Error: "Metro bundler failed"**

```bash
# Clear Metro cache
npm start -- --reset-cache

# Or delete cache manually
rm -rf node_modules/.cache
rm -rf $TMPDIR/metro-*
```

**Error: "Missing dependencies"**

```bash
# Reinstall all dependencies
rm -rf node_modules
npm install

# For iOS
cd ios && pod install && cd ..
```

### Deployment Issues

**Error: "Upload failed"**

1. Check your internet connection
2. Verify Zephyr authentication: `npx zephyr whoami`
3. Check Zephyr status page for outages

**Error: "Invalid configuration"**

1. Verify `metro.config.js` syntax
2. Check app name matches package.json
3. Ensure platform is correctly set

### iOS-Specific Issues

**Error: "Pod install failed"**

```bash
cd ios
pod deintegrate
pod cache clean --all
pod install
cd ..
```

**Error: "Xcode build failed"**

1. Open `ios/ZephyrQATestApp.xcworkspace` in Xcode
2. Check for signing issues
3. Select a valid development team

### Android-Specific Issues

**Error: "SDK not found"**

```bash
# Verify ANDROID_HOME is set
echo $ANDROID_HOME

# Should output something like:
# /Users/YOUR_USER/Library/Android/sdk
```

**Error: "Gradle build failed"**

```bash
cd android
./gradlew clean
cd ..
npm run android
```

---

## Quick Reference

### Common Commands

| Action              | Command                                                      |
| ------------------- | ------------------------------------------------------------ |
| Start Metro bundler | `npm start`                                                  |
| Run iOS app         | `npm run ios`                                                |
| Run Android app     | `npm run android`                                            |
| Build for iOS       | `PLATFORM=ios NODE_ENV=production npm run build:ios`         |
| Build for Android   | `PLATFORM=android NODE_ENV=production npm run build:android` |
| Clear Metro cache   | `npm start -- --reset-cache`                                 |
| Login to Zephyr     | `npx zephyr login`                                           |
| Check auth status   | `npx zephyr whoami`                                          |

### Important Files

| File                   | Purpose                              |
| ---------------------- | ------------------------------------ |
| `metro.config.js`      | Metro bundler + Zephyr configuration |
| `package.json`         | Dependencies and scripts             |
| `App.tsx`              | Main app component                   |
| `ios/Podfile`          | iOS dependencies                     |
| `android/build.gradle` | Android build configuration          |

### Environment Variables

| Variable   | Values                      | Description               |
| ---------- | --------------------------- | ------------------------- |
| `PLATFORM` | `ios`, `android`            | Target platform for build |
| `NODE_ENV` | `development`, `production` | Build environment         |

---

## Next Steps

After successfully setting up and publishing your app:

1. **Test OTA Updates** - See [QA_GUIDE_OTA.md](./QA_GUIDE_OTA.md)
2. **Set up CI/CD** - Automate deployments
3. **Configure environments** - Staging vs Production

---

## Support

If you encounter issues not covered here:

- [Zephyr Documentation](https://docs.zephyr-cloud.io)
- [Discord Community](https://zephyr-cloud.io/discord)
- [GitHub Issues](https://github.com/ZephyrCloudIO/zephyr-packages/issues)
