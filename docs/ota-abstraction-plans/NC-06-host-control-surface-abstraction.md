# NC-06: Host Control Surface Abstraction

Status: Completed
Type: Implementation
Priority: High

## Objective

Remove app-level deep access to Module Federation runtime globals in host apps by exposing stable control helpers from `zephyr-native-cache`.

## Problem

Host UIs were using low-level paths such as:

- `globalThis.__MFE_CHECK_UPDATES__`
- `globalThis.__FEDERATION__.__NATIVE__.__CACHE_LAYER__.clearCache()`

These are implementation details and are brittle as app-facing integration points.

## In Scope

- Add package-level control helpers:
  - `checkForUpdates(options?)`
  - `startUpdatePolling(intervalMs?)`
  - `stopUpdatePolling()`
  - `clearCache()`
- Keep backward-compatible global aliases in place.
- Update docs to recommend helper usage over deep global access.

## Out of Scope

- Notification UX policy (toasts, prompts, restart flows).
- Any changes to MF runtime internals.

## Acceptance Criteria

- App code can perform update and cache controls without touching deep MF globals.
- No breaking change for existing users of `register()` or global aliases.
- Controls behave as no-op/safe defaults when cache layer is not registered.

## Checklist

- [x] Add package-level control helper exports
- [x] Keep compatibility with existing globals
- [x] Update docs to reflect preferred surface
- [x] Integrate host app usage in `zephyr-native-cache-test`
