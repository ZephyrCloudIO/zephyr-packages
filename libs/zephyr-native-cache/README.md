# Zephyr Native Cache

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

A React Native native cache layer for Module Federation Metro bundles. It verifies bundle hashes, caches validated bundles on device, and supports background polling for updates.

## Installation

```bash
# npm
npm install zephyr-native-cache

# yarn
yarn add zephyr-native-cache

# pnpm
pnpm add zephyr-native-cache

# bun
bun add zephyr-native-cache
```

## Usage

Configure the Module Federation runtime plugin in your Metro MF setup:

```js
runtimePlugins: [require.resolve('zephyr-native-cache/runtime-plugin')];
```

Register the cache once at app startup before loading remotes:

```ts
import { register } from 'zephyr-native-cache';

register({
  maxCacheSizeBytes: 50 * 1024 * 1024,
  maxAgeMs: 3 * 24 * 60 * 60 * 1000,
  enablePolling: true,
  pollIntervalMs: 10 * 60 * 1000,
});
```

## Configuration

`register(config)` accepts:

- `bundleDir`: custom storage directory for cached bundles
- `maxCacheSizeBytes`: max cache size before LRU eviction (default `20MB`)
- `maxAgeMs`: stale threshold for cache entries (default `7 days`)
- `minCacheSizeBytes`: minimum cache size to preserve during cleanup
- `enablePolling`: start automatic manifest polling (default `true`)
- `pollIntervalMs`: polling interval in ms (default `5 minutes`)
- `forceCacheInDev`: enable cache in development mode (production is always enabled)

## Runtime APIs

`register` returns a `BundleCacheLayer` instance:

- `loadBundle(bundleUrl)`
- `checkForUpdates()`
- `startPolling(intervalMs?)`
- `stopPolling()`
- `clearCache()`
- `getLoadedBundles()`

`checkForUpdates` also supports policy options:

- `checkForUpdates({ policy: 'downloadOnly' })`
- `checkForUpdates({ policy: 'downloadAndApply' })`

It also exposes status helpers:

- `getCacheStatus()`
- `subscribeCacheStatus(listener)`

It also exposes globals for manual control:

- `globalThis.__MFE_CHECK_UPDATES__(options?)`
  - e.g. `globalThis.__MFE_CHECK_UPDATES__({ policy: 'downloadOnly' })`
  - default when omitted: `{ policy: 'downloadOnly' }`
- `globalThis.__MFE_START_UPDATE_POLLING__(intervalMs?)`
- `globalThis.__MFE_STOP_UPDATE_POLLING__()`

## Events

Use `CacheEvents` to observe cache lifecycle events:

- `bundle:load`
- `poll:start`
- `update:available`
- `update:downloaded`
- `poll:complete`

Example:

```ts
import { register } from 'zephyr-native-cache';

const cache = register();

cache.events.on('bundle:load', (event) => {
  console.log('[cache]', event.status, event.remoteName);
});

cache.events.on('poll:complete', (event) => {
  console.log('[cache] poll complete', event.updated, '/', event.checked);
});
```

## React Hook

For React Native UIs, use the built-in hook:

```ts
import { useCacheStatus } from 'zephyr-native-cache';

export function CacheStatusPanel() {
  const { status, latestUpdateEvent } = useCacheStatus();
  return null;
}
```

`useCacheStatus` exposes runtime state and raw update signals only. UI/notification behavior (toasts, banners, restart prompts, silent apply, etc.) is intentionally app-defined.

## Requirements

- React `>=19.0.0`
- React Native `>=0.79.0`

## License

Licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for more information.
