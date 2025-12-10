# Testing Zephyr Metro Plugin

Step-by-step guide to test the plugin with a Host + Remote setup.

## Prerequisites

- Node.js 18+
- Xcode (iOS) or Android Studio (Android)
- Zephyr account: `npx zephyr login`

## 1. Build the Plugin

```bash
pnpm nx build zephyr-metro-plugin
```

## 2. Create Host App

```bash
npx @react-native-community/cli init MetroHost
cd MetroHost
```

Install dependencies:

```bash
npm install zephyr-metro-plugin @module-federation/runtime
# Or link local plugin:
npm install file:../path/to/zephyr-packages/libs/zephyr-metro-plugin
```

Update `metro.config.js`:

```javascript
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withZephyr } = require('zephyr-metro-plugin');

const baseConfig = getDefaultConfig(__dirname);

module.exports = (async () => {
  const zephyrConfig = await withZephyr({
    name: 'MetroHost',
    target: 'ios',
    remotes: {
      MetroRemote: 'MetroRemote@http://localhost:9001/remoteEntry.js',
    },
  })(baseConfig);

  return mergeConfig(baseConfig, zephyrConfig);
})();
```

## 3. Create Remote App

```bash
npx @react-native-community/cli init MetroRemote
cd MetroRemote
```

Install dependencies:

```bash
npm install zephyr-metro-plugin @module-federation/runtime
```

Update `metro.config.js`:

```javascript
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withZephyr } = require('zephyr-metro-plugin');

const baseConfig = getDefaultConfig(__dirname);

module.exports = (async () => {
  const zephyrConfig = await withZephyr({
    name: 'MetroRemote',
    target: 'ios',
  })(baseConfig);

  return mergeConfig(baseConfig, zephyrConfig);
})();
```

## 4. Start Remote

```bash
cd MetroRemote
npx react-native start --port 9001
```

## 5. Start Host

```bash
cd MetroHost
npx react-native start
```

## 6. Verify Setup

Check manifest endpoint:

```bash
curl http://localhost:8081/zephyr-manifest.json
```

Should return JSON with remote dependencies.

Run on simulator:

```bash
npx react-native run-ios
```

## 7. Deploy to Zephyr

Build and deploy:

```bash
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output dist/ios/main.bundle \
  --assets-dest dist/ios
```

Check for:

- `assets/zephyr-manifest.json` generated
- Zephyr upload logs in console
- Deployment URL displayed

## Verify Zephyr Integration

| Check                                                     | Expected                      |
| --------------------------------------------------------- | ----------------------------- |
| Console shows `ZEPHYR` logs                               | Plugin initialized            |
| `http://localhost:8081/zephyr-manifest.json` returns JSON | Manifest endpoint works       |
| `assets/zephyr-manifest.json` exists after build          | Production manifest generated |
| Build logs show upload progress                           | Zephyr deployment working     |

## Troubleshooting

```bash
# Clear Metro cache
npx react-native start --reset-cache

# Reset Zephyr state
rm -rf ~/.zephyr

# Re-login to Zephyr
npx zephyr login
```
