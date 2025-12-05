# Testing Guide for Zephyr Metro Plugin

This guide explains how to manually test the `zephyr-metro-plugin` during development.

## Prerequisites

Before testing, ensure you have:

- **Node.js**: 18 or higher
- **React Native environment**: Xcode (iOS) and/or Android Studio (Android)
- **pnpm**: For monorepo package management
- **Zephyr Cloud account**: For deployment testing (optional for basic functionality testing)

## Building the Plugin Locally

### 1. Build the Plugin

From the monorepo root:

```bash
# Build the plugin and its dependencies
pnpm nx build zephyr-metro-plugin

# Or build with dependencies explicitly
pnpm nx build zephyr-metro-plugin --with-deps
```

### 2. Watch Mode (Development)

For iterative development, rebuild on changes:

```bash
# Watch the source files and rebuild
cd libs/zephyr-metro-plugin
pnpm exec tsc --watch -p tsconfig.lib.json
```

## Setting Up a Test React Native Project

### Option A: Using create-zephyr-apps (Recommended)

Generate a new React Native project with Zephyr integration:

```bash
npx create-zephyr-apps@latest
# Select "React Native" when prompted
```

### Option B: Manual Setup

1. **Create a new React Native project:**

   ```bash
   npx react-native init ZephyrMetroTest
   cd ZephyrMetroTest
   ```

2. **Install required dependencies:**

   ```bash
   npm install @module-federation/runtime
   ```

3. **Create Metro configuration:**

   ```javascript
   // metro.config.js
   const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
   const { withZephyr } = require('zephyr-metro-plugin');

   const baseConfig = getDefaultConfig(__dirname);

   // Export async config
   module.exports = (async () => {
     const zephyrConfig = await withZephyr({
       name: 'ZephyrMetroTest',
       target: 'ios', // or 'android'
       remotes: {
         // Optional: Add remote modules here
         // RemoteApp: 'RemoteApp@http://localhost:9000/remoteEntry.js',
       },
     })(baseConfig);

     return mergeConfig(baseConfig, zephyrConfig);
   })();
   ```

## API Reference

### `withZephyr(options)(metroConfig)`

The main configuration function for Zephyr Metro plugin.

**Options (`ZephyrMetroOptions`):**

| Option    | Type                     | Description                             |
| --------- | ------------------------ | --------------------------------------- |
| `name`    | `string`                 | Application name (optional)             |
| `remotes` | `Record<string, string>` | Remote module configurations (optional) |
| `target`  | `'ios' \| 'android'`     | Target platform (optional)              |

**Returns:** An async function that takes a Metro `ConfigT` and returns an enhanced config.

**Example:**

```javascript
const enhancedConfig = await withZephyr({
  name: 'MyApp',
  target: 'ios',
  remotes: {
    SharedUI: 'SharedUI@http://localhost:8081/remoteEntry.js',
  },
})(baseMetroConfig);
```

## Linking the Local Plugin

### Method 1: Using pnpm link (Recommended)

From the monorepo root:

```bash
# Create a global link for the plugin
cd libs/zephyr-metro-plugin
pnpm link --global

# In your test project
cd /path/to/your/test-project
pnpm link --global zephyr-metro-plugin
```

### Method 2: Using file: Protocol

In your test project's `package.json`:

```json
{
  "dependencies": {
    "zephyr-metro-plugin": "file:/path/to/zephyr-packages/libs/zephyr-metro-plugin"
  }
}
```

Then run `npm install` or `pnpm install`.

### Method 3: Using yalc

```bash
# Install yalc globally
npm install -g yalc

# From the plugin directory (after building)
cd libs/zephyr-metro-plugin
yalc publish

# In your test project
cd /path/to/your/test-project
yalc add zephyr-metro-plugin
```

## Testing Scenarios

### Development Mode Testing

1. **Start Metro bundler:**

   ```bash
   npx react-native start
   ```

2. **Verify plugin initialization:**

   - Check console output for `ZEPHYR` log messages
   - Confirm no errors during Metro startup
   - Look for: "Zephyr Metro plugin configured successfully"

3. **Test manifest endpoint:**

   - Open browser to `http://localhost:8081/zephyr-manifest.json`
   - Should return a JSON manifest with resolved dependencies

4. **Run on simulator/device:**

   ```bash
   # iOS
   npx react-native run-ios

   # Android
   npx react-native run-android
   ```

5. **Verify transformer injection:**
   - The plugin adds a custom transformer at `zephyr-transformer`
   - Check that entry files (index.js, App.js) have Zephyr runtime injected

### Production Build Testing

1. **Build for iOS:**

   ```bash
   npx react-native bundle \
     --platform ios \
     --dev false \
     --entry-file index.js \
     --bundle-output dist/ios/main.bundle \
     --assets-dest dist/ios
   ```

2. **Build for Android:**

   ```bash
   npx react-native bundle \
     --platform android \
     --dev false \
     --entry-file index.js \
     --bundle-output dist/android/main.bundle \
     --assets-dest dist/android
   ```

3. **Verify outputs:**
   - Check `dist/` directory for generated bundles
   - Verify `assets/zephyr-manifest.json` is generated
   - Confirm asset files are present

### Authentication Testing

#### With Valid Credentials

1. Log in to Zephyr:

   ```bash
   npx zephyr login
   ```

2. Run a production build and verify:
   - Build statistics are generated
   - Assets are uploaded to Zephyr Cloud
   - Deployment URL is displayed

#### Without Credentials

1. Ensure you're logged out:

   ```bash
   rm -rf ~/.zephyr/persist
   ```

2. Run a build and verify:
   - Build completes without crashing
   - Authentication prompt appears (or timeout message)
   - Local build artifacts are still generated
   - Manifest file is still created locally

## Testing Specific Features

### Module Federation Testing

1. **Configure remotes:**

   ```javascript
   // metro.config.js
   const zephyrConfig = await withZephyr({
     name: 'HostApp',
     target: 'ios',
     remotes: {
       RemoteButton: 'RemoteButton@http://localhost:9001/remoteEntry.js',
       RemoteCard: 'RemoteCard@http://localhost:9002/remoteEntry.js',
     },
   })(baseConfig);
   ```

2. **Test remote resolution:**

   - Verify remotes are extracted during build
   - Check that remote URLs are properly resolved through Zephyr
   - Confirm manifest contains resolved dependency information

3. **Runtime testing:**
   - Load a remote module dynamically using `@module-federation/runtime`
   - Verify shared dependencies work correctly

### Manifest Generation Testing

1. **Development mode:**

   - Start Metro: `npx react-native start`
   - Fetch: `curl http://localhost:8081/zephyr-manifest.json`
   - Verify JSON structure with resolved dependencies

2. **Production mode:**
   - Run bundle command
   - Check `assets/zephyr-manifest.json` exists
   - Verify manifest content matches configured remotes

### Resolver Enhancement Testing

The plugin adds `zephyr` to Metro's resolver main fields. Test by:

1. Creating a package with `zephyr` field in package.json
2. Verifying Metro resolves to the zephyr-specified entry

## Debugging

### Enable Debug Logging

The plugin uses `ze_log` from zephyr-agent. Check console output for:

- `[ZEPHYR]` prefixed messages
- Configuration logs
- Manifest generation logs
- Error details

### Check Error Details

When errors occur, Zephyr writes detailed error information to temp files:

```bash
# Error files are typically at:
cat /tmp/ze*.json
```

### Common Issues

| Issue                                      | Solution                                                           |
| ------------------------------------------ | ------------------------------------------------------------------ |
| "Cannot find module 'zephyr-metro-plugin'" | Ensure plugin is built and linked correctly                        |
| Manifest endpoint returns 500              | Check for errors in Metro console, verify ZephyrEngine initialized |
| Transformer not applied                    | Verify `babelTransformerPath` is set to `zephyr-transformer`       |
| Remotes not resolved                       | Check network connectivity, verify Zephyr authentication           |
| "ZephyrEngine create failed"               | Check package.json exists in project root                          |
| EISDIR errors                              | Clear `~/.zephyr` directory: `rm -rf ~/.zephyr`                    |

### Inspecting Plugin Behavior

The plugin performs these operations:

1. **On config load:**

   - Creates ZephyrEngine instance
   - Extracts remote dependencies from options
   - Resolves dependencies through Zephyr API
   - Adds custom transformer
   - Enhances resolver with `zephyr` main field
   - Adds `/zephyr-manifest.json` middleware endpoint
   - Generates manifest file at `assets/zephyr-manifest.json`

2. **Transformer injection:**
   - Wraps `metro-react-native-babel-transformer`
   - Injects Zephyr runtime initialization into entry files
   - Targets: `index.js`, `App.js`, `App.tsx`, files with `AppRegistry` or `loadRemote`

## Verification Checklist

Use this checklist to verify your changes work correctly:

- [ ] Plugin builds without TypeScript errors: `pnpm nx build zephyr-metro-plugin`
- [ ] Lint passes: `pnpm nx lint zephyr-metro-plugin`
- [ ] Metro bundler starts successfully with the plugin
- [ ] Console shows "Zephyr Metro plugin configured successfully"
- [ ] Zephyr transformer is referenced in enhanced config
- [ ] Resolver includes `zephyr` in main fields
- [ ] Development manifest endpoint works: `http://localhost:8081/zephyr-manifest.json`
- [ ] Production builds complete for iOS
- [ ] Production builds complete for Android
- [ ] `assets/zephyr-manifest.json` is generated
- [ ] Plugin handles missing authentication gracefully
- [ ] Remote dependencies are resolved (if configured)

## Running Plugin Tests

Currently, the plugin has Jest configured but no tests implemented:

```bash
# Run tests (when available)
pnpm nx test zephyr-metro-plugin

# Check test configuration
cat libs/zephyr-metro-plugin/jest.config.ts
```

## Troubleshooting

### Reset Zephyr State

If you encounter persistent issues, reset the Zephyr local state:

```bash
rm -rf ~/.zephyr
```

### Clear Metro Cache

Clear Metro bundler cache if you see stale behavior:

```bash
npx react-native start --reset-cache
```

### Rebuild Everything

Force a clean rebuild:

```bash
# In the monorepo
pnpm nx reset
pnpm install
pnpm nx build zephyr-metro-plugin --skip-nx-cache
```

### Verify Plugin Exports

Check that the plugin exports are correct:

```bash
node -e "console.log(Object.keys(require('./libs/zephyr-metro-plugin/dist')))"
# Should show: withZephyr, withZephyrMetro, zephyrTransformer
```

---

## Notes

- The plugin's main export is `withZephyr` which takes an options object, not positional arguments
- `withZephyrMetro` is an alias for `withZephyr`
- The transformer is exported as `zephyrTransformer` but is typically referenced by path internally
- The README.md may contain outdated API examples - this testing guide reflects the current implementation
