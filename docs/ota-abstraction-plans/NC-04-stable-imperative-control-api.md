# NC-04: Stable Imperative Control API

Status: Completed
Type: Implementation
Priority: Medium

## Objective

Provide a stable imperative control surface for `zephyr-native-cache` that replaces ad-hoc global control usage while preserving backward compatibility.

## Current State

Controls are now exposed through the app-facing `ZephyrNativeCache` facade and package-level helpers:

- `ZephyrNativeCache.checkForUpdates(options?)`
- `ZephyrNativeCache.startUpdatePolling(intervalMs?)`
- `ZephyrNativeCache.stopUpdatePolling()`
- `ZephyrNativeCache.clearCache()`
- `ZephyrNativeCache.reloadApp()`

The legacy globals remain available as compatibility aliases:

- `globalThis.__MFE_CHECK_UPDATES__`
- `globalThis.__MFE_START_UPDATE_POLLING__`
- `globalThis.__MFE_STOP_UPDATE_POLLING__`

These globals work, but are not the recommended public API boundary for app code.

## Goals

- Define a package-level imperative API that is easy to discover and type-safe.
- Keep legacy globals as aliases/deprecation bridge.
- Provide a native reload wrapper so apps do not import the raw native module.
- Keep API strictly runtime-control oriented; notification/UX behavior stays application-owned.

## In Scope

- `ZephyrNativeCache` facade with register, status, subscription, update, polling, cache, and reload controls.
- Package-level helper exports for existing integrations.
- Backward-compatible global aliases.
- Documentation for the preferred public surface.

## Out of Scope

- Defining notification behavior such as toasts, modals, forced restart prompts, or update banners.
- Defining a deprecation/removal timeline for legacy globals.

## Implemented API

Facade API:

```ts
import { ZephyrNativeCache } from 'zephyr-native-cache';

ZephyrNativeCache.checkForUpdates({ policy: 'downloadOnly' });
ZephyrNativeCache.startUpdatePolling();
ZephyrNativeCache.stopUpdatePolling();
await ZephyrNativeCache.clearCache();
ZephyrNativeCache.reloadApp();
```

Package-level helpers remain exported for integrations that prefer named functions:

```ts
import { checkForUpdates, startUpdatePolling, stopUpdatePolling } from 'zephyr-native-cache';
```

## Migration Strategy

1. Prefer `ZephyrNativeCache` in app code.
2. Keep package-level helpers for existing integrations.
3. Keep globals as pass-through aliases for backward compatibility.
4. Defer deprecation warnings and removal timeline until a later compatibility decision.

## Acceptance Criteria

- App code can use stable controls without touching deep globals.
- Existing global aliases continue to work.
- Runtime-control API remains policy-only and does not impose notification UX.

## Checklist

- [x] Add `ZephyrNativeCache` facade
- [x] Add package-level helper exports
- [x] Keep global aliases
- [x] Document preferred control surface
- [x] Mark completed in `EXECUTION_TRACKER.md`
