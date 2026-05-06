# NC-02: Official React Hook API (`useCacheStatus`)

Status: Completed
Type: Implementation
Priority: High
Depends on: `NC-01`

## Objective

Provide an official React hook that exposes cache status ergonomically for host UIs and dev tooling.

## In Scope

- Add `useCacheStatus` export in `zephyr-native-cache`.
- Hook should consume `NC-01` APIs (snapshot + subscription), not hidden globals.
- Keep the hook contract policy-free (state and signals only, no notification helpers).

## Out of Scope

- Opinionated UI components (panel design stays app-specific).
- State management integrations (Redux/Zustand adapters).

## Proposed Hook Contract (Draft)

```ts
const { status, latestUpdateEvent } = useCacheStatus();
```

Notification UX remains app-defined (toast/modal/restart prompts/silent apply).

## Proposed Execution

1. Add hook implementation under `src/react/useCacheStatus.ts` (or equivalent).
2. Use `register()`/cache layer references safely and subscribe on mount.
3. Ensure initial snapshot hydration works even if events happened before mount.
4. Export from package entrypoint.
5. Add tests for mount/unmount behavior and update propagation.

## Acceptance Criteria

- Hook exposes stable state immediately after mount.
- Hook updates on status changes without memory leaks.
- App no longer needs to manually wire cache events for standard status UI.

## Risks / Notes

- Package currently has core/runtime focus; adding React hook should not break non-React consumers.
- Keep hook optional and tree-shakeable.

## Deliverables

- New hook implementation and type exports.
- Tests and README usage section.

## Checklist

- [x] Finalize hook return shape
- [x] Implement hook with subscription cleanup
- [x] Add tests
- [x] Update docs
- [x] Mark completed in `EXECUTION_TRACKER.md`
