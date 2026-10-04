---
summary: Local-only attribution capture and aggregate JSON export for a browser-isolated report in the Zephyr app.
status: proposed
date: 2026-10-04
read_when:
  - Changing attribution capture, configuration, report exports, or release verification.
---

# Local attribution export and browser import

The maintainer chose local-only attribution to prove the reporting experience
without cloud ingestion. This supersedes the earlier proposed reporting API,
BYOC collector, and hosted OSS exception. The SDK implementation in this PR removes
remote transport; the [companion app PR](https://github.com/ZephyrCloudIO/zephyr-cloud-io/pull/3803)
adds an isolated report viewer under Activity → Contributors. Both remain subject
to review and release. Existing build metadata and APIs are not restricted.

## Implemented boundary

- Capture and optional agent hooks require explicit opt-in. Local source records,
  metadata ledgers, and version receipts remain under the worktree Git directory.
- The attribution uploader, gateway path, policy and upload wire types are removed.
  Neither snapshots nor build stats include attribution evidence or references.
- Old `storage: "remote"` files resolve to local. New remote flags/settings fail.
  Legacy `content` and `repositoryId` preferences are inert. Billing, OSS status,
  BYOC settings, and server policy cannot enable attribution network requests.
- `ze-cli attribution report <before> <after>` writes aggregate JSON. Source IDs
  and locally retained snapshot IDs are accepted. No authentication is required.
  Default output is a unique owner-only file under the private Git directory;
  `--output` selects a new path and never overwrites. Keep custom exports outside
  deployment output and tracked directories.

Ordinary deployment still uploads application assets and existing metadata.
No package version is manually bumped or published by this change.

## Report and interpretation

The exported `LocalAttributionReport` in
[report.ts](../libs/zephyr-agent/src/lib/change-attribution/report.ts) is the SDK
contract. It has a fixed kind, schema version 1, self-reported identity label,
creation time, two capture IDs/fingerprints, same-commit flag, changed-file counts,
and added/removed counts grouped by recorded AI, human, and unknown origin.

It omits source text, patches, file paths, contributor identities, sessions,
prompts, transcripts, models, usage, and costs. The detailed `compare` command
remains local and is not a browser report. Counts represent net differences;
reverted intermediate changes disappear. Binary files have no line counts.
Unknown is never inferred to be human. Removal origin describes the original
contribution, not the deleting actor. These reports do not certify authorship,
ownership, license compliance, or individual productivity.

The app accepts strict schema version 1, no unknown fields, valid count sums,
and files no larger than 64 KiB. It owns file selection, parsing and text-only
rendering inside an opaque-origin iframe with all network connections blocked.
No contents pass to parent React state, analytics, error reporting, or a server.
There is no report upload, cloud retention, or automatic association with the
selected application. The app design defines the full schema and browser tests.

## Retention, consent, and deferred agreements

Clearing, reloading, or leaving the viewer removes its display. Original exports,
source receipts and backups remain on the user's machine until they remove them;
the SDK does not prune or synchronize them. POSIX permissions are not encryption.
Users must retain the private source records to compare versions; a fresh clone
cannot fetch them from Zephyr.

Capture notices and report limitations should be reviewed by counsel before
launch. They are not a liability guarantee. Custom customer agreements and
versioned source authorization remain requirements to design before any future
cloud/BYOC/OSS ingestion; those modes are deferred, not authorized by this work.
An open-source repository or willingness to share does not bypass local-only
behavior. This PR adds no click-through contract or invented legal terms.

## Verification and release

- Agent tests cover local receipts and omission from snapshot/build-stat output,
  including legacy remote configuration and free/paid/BYOC server policies.
- Setup/config tests cover rejected remote options, legacy normalization, unknown
  fields, and private file safety. Report tests cover aggregate counting, unknown
  origins, removals, and absence of copied source/identity fields.
- After building the agent/CLI, `node scripts/verify-attribution-storage.mjs
/path/to/disposable-enabled-repository` checks the built export command,
  private file mode, source/path omission, legacy settings, and no-overwrite.
- The companion app's Chromium suite verifies import, clearing, invalid input,
  opaque-origin isolation, denied networking/storage, and the static script hash.
- Update packaged core/CLI skills and record Intent review outcomes. Independent
  fresh-consumer-agent validation is distinct from maintainer-run fixtures.

[Issue 647](https://github.com/ZephyrCloudIO/zephyr-packages/issues/647) tracks the
coordinated release. Verify published tarballs contain the new report command,
updated guidance, and no remote attribution transport before announcing support.
Verify app availability separately. Cloud collectors and APIs need a new security
review and concrete operational/retention design if revisited later.
