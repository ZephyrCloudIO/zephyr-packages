# Local attribution storage and reports

Read this when configuring attribution storage or exporting a browser report.
First enable tracking with [Change Attribution](change-attribution.md).

## Local-only configuration

Commit `.zephyr/attribution.json` at the Git root. Apps in a monorepo share it:

```json
{ "schemaVersion": 1, "enabled": true, "storage": "local" }
```

This SDK supports local capture only. Missing storage and legacy `"storage":
"remote"` files both resolve to local. New remote settings are rejected. Legacy
`content` and `repositoryId` fields may remain on disk but have no sharing effect.
Account tier, OSS status, BYOC deployment, and server policy cannot enable
attribution uploads. The remote transport and wire contracts have been removed.
Uploaded snapshots and build stats contain no attribution evidence or references.
Ordinary deployments still upload their assets and normal deployment metadata.

```bash
pnpm exec ze-cli attribution configure --storage local
pnpm exec ze-cli attribution status
```

Configuration requires existing opt-in via `with-zephyr . --attribution`.
Unknown fields, including tokens, URLs, and tier, are rejected. Invalid build-time
configuration makes capture unavailable without blocking deployment. A legacy
private `--storage local --local` restriction remains supported; it writes
`zephyr-attribution/config.local.json` under the worktree Git directory without
changing shared preferences. No configuration enables remote attribution.

## Export a report for the app

Save two captures (or use locally retained Zephyr snapshot IDs), then export:

```bash
pnpm exec ze-cli attribution capture --format json
# Make changes, then capture again; use the returned sourceId values.
pnpm exec ze-cli attribution capture --format json
pnpm exec ze-cli attribution report <before> <after> --format json
```

The command prints the report's absolute path. By default it creates a new,
owner-only JSON file under the private Git directory. `--output /path/report.json`
chooses another location and refuses to overwrite an existing file. Keep custom
exports outside build output and tracked directories; they contain local analytics.
Neither export nor capture needs authentication or sends a request.

Open **Activity → Contributors → Local attribution report** in a compatible
Zephyr app and choose the JSON file. The companion UI change is tracked in
[PR 3803](https://github.com/ZephyrCloudIO/zephyr-cloud-io/pull/3803); this SDK
package does not itself ship the dashboard. File selection, parsing, and display
happen within an opaque-origin frame with network access blocked. The viewer
keeps the report in tab memory only; clear, reload, or leaving removes its display.
The parent app receives no report contents, and there is no server upload/storage.
The original export remains on the user's disk until they delete it.

Reports contain aggregate changed-file counts and added/removed line counts by
recorded AI, human, and unknown origin, capture IDs/fingerprints, generation time,
and whether captures share a Git commit. They omit source text, patches, paths,
person/session identities, prompts, transcripts, usage, and cost. Unknown is
never inferred to be human. Removed origins identify original contributions,
not the deleting actor. Counts describe net differences, not all work performed.
These self-reported observations do not certify authorship, ownership, license
compliance, or productivity. Report schema version 1 is limited to 64 KiB in the UI.

## Retention and release boundary

Private source copies, metadata ledgers, receipts, and exports are not pruned or
synchronized automatically. Users control deletion, local backups, and filesystem
permissions; owner-only POSIX permissions are not disk encryption. Windows relies
on worktree ACLs. A fresh clone lacks the records required for comparison.

Cloud analytics, customer collectors, hosted OSS ingestion, source-sharing
agreements, and their retention systems are deferred. Do not represent them as
available. [Issue 647](https://github.com/ZephyrCloudIO/zephyr-packages/issues/647)
tracks coordinated package publishing and the companion app availability.

## Verification

Build the agent and CLI, then use a disposable repository with attribution enabled:

```bash
node scripts/verify-attribution-storage.mjs /tmp/zephyr-attribution-demo
```

The built SDK/CLI verifier checks legacy normalization, remote-option rejection,
aggregate export, absence of source/paths, private default permissions, and
no-overwrite behavior. Snapshot/build-stat regression tests separately verify
that old server policies cannot enable attribution requests. The companion app
has real-browser isolation tests; no cloud service is needed for these checks.
