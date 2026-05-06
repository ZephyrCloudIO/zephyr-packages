# NC-03: Update Policy Modes for `checkForUpdates`

Status: Completed
Type: Implementation
Priority: High

## Objective

Add explicit update policy modes so callers can choose behavior when updates are detected.

## In Scope

- Extend `checkForUpdates` with optional policy argument.
- Initial policy set (draft):
  - `downloadOnly` (current-like behavior)
  - `downloadAndApply` (prepare and apply where supported)
- Keep no-argument call backward compatible.

## Out of Scope

- Broad rollback state machine redesign.
- App-specific restart UX logic.

## Proposed API (Draft)

```ts
cache.checkForUpdates(); // default policy
cache.checkForUpdates({ policy: 'downloadOnly' });
cache.checkForUpdates({ policy: 'downloadAndApply' });
```

## Proposed Execution

1. Add policy types in cache config/types.
2. Thread policy into polling/manual update path in `BundleCacheLayer`.
3. Define apply semantics and safe fallback if apply is not possible.
4. Emit clear events for each policy path.
5. Add tests for both policy modes and backward compatibility.

## Acceptance Criteria

- Default behavior remains compatible with existing callsites.
- Policy-specific behavior is deterministic and documented.
- Event/status outputs clearly represent what happened.

## Risks / Notes

- `downloadAndApply` must be platform/runtime-safe; failures should degrade gracefully.
- Avoid policy ambiguity when called from polling timer vs manual controls.

## Deliverables

- API/type changes + implementation in `BundleCacheLayer`.
- Tests and documentation updates.

## Checklist

- [ ] Finalize policy enum and default
- [ ] Implement policy branching
- [ ] Ensure polling compatibility
- [ ] Add tests
- [ ] Update docs
- [ ] Mark completed in `EXECUTION_TRACKER.md`
