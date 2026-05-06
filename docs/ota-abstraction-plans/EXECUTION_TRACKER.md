# OTA Abstraction Execution Tracker

Last updated: 2026-05-06

## Selected Scope

This tracker covers only the NC items selected for execution/planning:

- `NC-01` Add first-class cache status API.
- `NC-02` Add official React hook API for cache status.
- `NC-03` Add update policy modes.
- `NC-04` Create plan for stable imperative control API.

Explicitly out of scope per direction:

- `MP-01`, `MP-02`, `MP-03`, `MP-04`, `MP-05`.
- `NC-05`.

## Status Board

| ID    | Title                         | Type           | Status  | Notes                              |
| ----- | ----------------------------- | -------------- | ------- | ---------------------------------- |
| NC-01 | Cache status API              | Implementation | Planned | Foundation for NC-02               |
| NC-02 | React hook API                | Implementation | Planned | Depends on NC-01 primitives        |
| NC-03 | Update policy modes           | Implementation | Planned | API + behavior updates             |
| NC-04 | Stable imperative control API | Plan only      | Planned | Backward-compatible migration plan |

## Recommended Execution Order

1. `NC-01` (core status primitives).
2. `NC-02` (hook built on NC-01).
3. `NC-03` (policy extensions on cache update flow).
4. `NC-04` remains plan-only until implementation is authorized.

## Dependency Notes

- `NC-02` should consume `NC-01` APIs, not global internals.
- `NC-03` should avoid breaking current `checkForUpdates()` callsites.

## Change Log

- 2026-05-06: Initial tracker created with selected scope and status board.
- 2026-05-06: Scope narrowed to NC-only items; MP files removed from active plan.
