# OTA Abstraction Execution Tracker

Last updated: 2026-05-12

## Selected Scope

This tracker covers only the NC items selected for execution/planning:

- `NC-01` Add first-class cache status API.
- `NC-02` Add official React hook API for cache status.
- `NC-03` Add update policy modes.
- `NC-04` Add stable imperative control API.
- `NC-06` Abstract host control surface away from deep MF globals.

Explicitly out of scope per direction:

- `MP-01`, `MP-02`, `MP-03`, `MP-04`, `MP-05`.
- `NC-05`.

## Status Board

| ID    | Title                            | Type           | Status    | Notes                                      |
| ----- | -------------------------------- | -------------- | --------- | ------------------------------------------ |
| NC-01 | Cache status API                 | Implementation | Completed | Foundation for NC-02                       |
| NC-02 | React hook API                   | Implementation | Completed | Depends on NC-01 primitives                |
| NC-03 | Update policy modes              | Implementation | Completed | API + behavior updates                     |
| NC-04 | Stable imperative control API    | Implementation | Completed | Backward-compatible facade and helpers     |
| NC-06 | Host control surface abstraction | Implementation | Completed | Package helpers replace deep global access |

## Recommended Execution Order

1. Selected NC implementation work is complete for this PR series.

## Dependency Notes

- `NC-02` should consume `NC-01` APIs, not global internals.
- `NC-03` should avoid breaking current `checkForUpdates()` callsites.

## Change Log

- 2026-05-06: Initial tracker created with selected scope and status board.
- 2026-05-06: Scope narrowed to NC-only items; MP files removed from active plan.
- 2026-05-06: Completed NC-01, NC-02, and NC-03 implementation work.
- 2026-05-06: Completed NC-06 control-surface abstraction work.
- 2026-05-12: Completed NC-04 stable facade/control API work.
