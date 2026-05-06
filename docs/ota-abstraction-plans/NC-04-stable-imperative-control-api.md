# NC-04: Stable Imperative Control API (Planning)

Status: Planned
Type: Plan Only (implementation later)
Priority: Medium

## Objective

Design a stable imperative control surface for `zephyr-native-cache` that replaces ad-hoc global control usage while preserving backward compatibility.

## Current State

Current controls are exposed globally:

- `globalThis.__MFE_CHECK_UPDATES__`
- `globalThis.__MFE_START_UPDATE_POLLING__`
- `globalThis.__MFE_STOP_UPDATE_POLLING__`

These work, but are not an ideal long-term public API boundary.

## Planning Goals

- Define a package-level imperative API that is easy to discover and type-safe.
- Keep legacy globals as aliases/deprecation bridge.
- Define deprecation messaging and migration timeline.
- Keep API strictly runtime-control oriented; notification/UX behavior stays application-owned.

## In Scope (Planning)

- API proposal and migration strategy.
- Compatibility strategy with existing apps and scripts.
- Testing requirements for old + new paths.

## Out of Scope (for now)

- Implementing the new API in this phase.
- Defining notification behavior such as toasts, modals, forced restart prompts, or update banners.

## Proposed API Direction (Draft)

Option A: exported controls bound to singleton cache layer:

```ts
import { checkForUpdates, startUpdatePolling, stopUpdatePolling } from 'zephyr-native-cache';
```

Option B: explicit control object from register:

```ts
const cache = register();
cache.controls.checkForUpdates();
cache.controls.startPolling();
cache.controls.stopPolling();
```

Preferred draft: Option B (clear ownership and easier multi-instance reasoning if needed later).

## Migration Strategy (Draft)

1. Introduce new API.
2. Keep globals as pass-through aliases.
3. Emit development warning once per session when legacy globals are accessed.
4. Document migration and deprecation timeline.

## Acceptance Criteria (Planning)

- API proposal is approved.
- Migration/deprecation approach is approved.
- Implementation work items are broken down and estimable.

## Checklist

- [ ] Approve API direction
- [ ] Approve migration/deprecation timeline
- [ ] Create implementation tasks
- [ ] Mark as ready-for-implementation in `EXECUTION_TRACKER.md`
