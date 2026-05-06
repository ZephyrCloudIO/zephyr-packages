# NC-01: First-Class Cache Status API

Status: Completed
Type: Implementation
Priority: High

## Objective

Expose a stable status surface from `zephyr-native-cache` so apps can read cache/poll/update state without directly reaching into globals or reassembling event state manually.

## In Scope

- Add public status API (draft):
  - `getCacheStatus()`
  - `subscribeCacheStatus(listener)`
- Include key status fields:
  - remote bundle statuses,
  - polling state,
  - last poll timestamp/results,
  - pending updates.
- Keep event emitter as lower-level primitive.

## Out of Scope

- React hook implementation details (`NC-02` consumes this API).
- New rollback policy mechanics (`NC-05` not needed).

## Proposed Execution

1. Define `CacheStatusSnapshot` types in `src/types.ts` (or status-specific types file).
2. Maintain internal status state in `BundleCacheLayer` using existing events and polling flow.
3. Add read and subscribe methods to public API.
4. Export API through `src/index.ts`.
5. Add tests for status transitions and snapshot correctness.

## Acceptance Criteria

- Consumers can obtain a complete status snapshot at any time.
- Consumers can subscribe/unsubscribe to status updates safely.
- No breaking changes for existing `register()` usage.

## Risks / Notes

- Must avoid status duplication bugs between event stream and snapshot state.
- Snapshot should remain lightweight and serializable.

## Deliverables

- Type additions and `BundleCacheLayer` API additions.
- Tests for cache-hit/downloaded/skipped and polling transitions.

## Checklist

- [x] Finalize status snapshot shape
- [x] Implement snapshot state tracking
- [x] Implement get/subscribe APIs
- [x] Add tests
- [x] Mark completed in `EXECUTION_TRACKER.md`
