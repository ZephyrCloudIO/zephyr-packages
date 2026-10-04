# Attribution storage and repository policy

Read this when selecting storage, controlling source-text sharing, or implementing
the endpoint. First enable tracking with [Change Attribution](change-attribution.md).

## Repository preferences

Commit `.zephyr/attribution.json` at the Git root. Each repo has its own file;
apps in a monorepo share its capture preferences. It contains preferences, never
credentials, custom endpoint URLs, or a claimed account tier:

```json
{ "schemaVersion": 1, "enabled": true, "storage": "local" }
```

Storage configuration requires an existing enabled repository; enable with
`with-zephyr . --attribution` first. A blank codemod storage answer preserves
existing preferences. Missing `storage`, including older configs, means **local**. Source copies,
attribution, and version receipts stay in the worktree Git directory. Local
mode neither resolves attribution credentials nor makes attribution requests,
and attaches no attribution to uploaded snapshots/build stats. Ordinary Zephyr
deployment still uploads its assets and normal deployment metadata.

```bash
pnpm exec ze-cli attribution configure --storage remote
# Paid/BYOC: independently choose source-text fields.
pnpm exec ze-cli attribution configure --storage remote --patches include --lines omit
pnpm exec ze-cli attribution status
```

| Mode/account       | Source text sent                                        |
| ------------------ | ------------------------------------------------------- |
| Local, any account | None                                                    |
| Remote, free       | Unified patch and structured changed-line text required |
| Remote, paid       | Neither by default; either/both optional                |
| Remote, BYOC       | Neither by default; either/both optional                |

Free remote source-text opt-out is rejected before sending. Choose local to keep
it local. Tier comes from authenticated service policy, not repo configuration
or deployment provider. Paid/BYOC shared preferences can include
`"content": { "patch": false, "lines": false }` or enable either field.

All remote records include file hashes, attribution ranges/origins, and available
session/model/effort/usage metadata. `patch` is the unified difference against the
**captured Git HEAD**, with ordinary context. `lines` contains text/origin of
added/removed lines. A patch inherently contains line text even when `lines` is
false; omit both to share no source text. Range positions/origins remain metadata.
New files can have every line in their difference. Full source snapshots and
binary contents are not uploaded. Exclusions apply to working source and HEAD.
Remote payloads are limited to 20 MiB. Server version comparisons need the Git
baseline; patches cannot reconstruct unchanged committed files on their own.

## Private restriction and precedence

Keep this checkout local even when its shared config selects remote:

```bash
pnpm exec ze-cli attribution configure --storage local --local
```

This atomically writes `zephyr-attribution/config.local.json` inside the worktree
Git directory with owner-only POSIX file permissions. It preserves shared config
and cannot enable remote or additional content. Deliberately remove that file
to resume shared settings. Local receipts also use owner-only files: this is
filesystem protection, not disk encryption. Windows relies on worktree ACLs.

Private restrictions apply first. Sharing requires both repo opt-in and server
authorization. An optional shared `repositoryId` must match the service's
application/repository binding. Unknown fields, including tokens, URLs, and tier,
are rejected by configuration commands. Invalid or newer configuration at build
time disables sharing without blocking deployment; the SDK does not ignore
unrecognized permissions and accidentally authorize remote uploads. Credentials use existing SDK authentication/private storage; CI
supplies credentials through its secret environment.

## Control-plane contract and secure persistence

The SDK implements the client and shared types. **Server endpoints, policy
management, encryption, retention, and BYOC routing are not implemented in this
workspace.** Remote publication requires `ATTRIBUTION_POLICY` in authenticated
application configuration, with this shape:

```json
{
  "schemaVersion": 1,
  "repositoryId": "repo-123",
  "revision": "policy-revision-7",
  "storage": "remote",
  "tier": "paid",
  "content": { "patch": true, "lines": true }
}
```

Policy `content` is the server's allowlist, not source-text opt-in. Paid/BYOC
repo preferences still default off; free requires both allowed and included.
Persist policy by organization/repository, allow repo-admin updates, retain
revision/audit history, and derive tier from billing/BYOC entitlement. A repo
file must never be able to claim a different tier.

The client sends `AttributionUploadRequest` to **`POST /attribution`** on the
existing authenticated API gateway. It includes application/repository/build/
snapshot IDs, policy revision, effective content flags, attribution metadata,
and optional HEAD comparison. It resolves bearer credentials at request time,
requires HTTPS (loopback HTTP for fixtures), refuses redirects, and omits response
bodies from diagnostics. Raw prompts, agent responses, transcript paths, and
full source copies are excluded.

The server must authenticate the caller, authorize repository access, verify
application/build ownership, independently enforce current tier/content policy
and revision, and reject stale or unauthorized requests. Deduplicate the
repository/application/build `Idempotency-Key`: return the original record for
retries and reject conflicting evidence for the same build. Store immutable
records tied to those IDs and source fingerprint.

Return `AttributionUploadResponse`: `status: "ok"`, opaque record ID, matching
application/repository/build/snapshot IDs, and source fingerprint. Only after
acknowledgment does the client put a small record reference in snapshots and
build stats. Full evidence stays at the private endpoint. A private delivery
receipt stays locally. If policy, source capture, credentials, delivery, or
acknowledgment is unavailable, deployment continues without an attribution
reference and emits a warning; source evidence stays local when capture succeeded.
This also permits deployment before the control-plane endpoint ships. Reconcile pending records when the build publishes and expire
orphaned records from failed deployments.

Store policy in an access-controlled database and source evidence in private
encrypted object storage using managed keys. Keep storage credentials in a
service secret manager. Authorize evidence reads by repo membership, enforce
retention/deletion, and audit policy changes/access without logging source
bodies. Resolve BYOC destinations/credentials through authorized server
configuration, never a repo-supplied URL. These are server requirements, not
guarantees established by the client test.

## Verification

Build the agent and CLI, then run against a disposable generated app:

```bash
node scripts/verify-attribution-storage.mjs /tmp/zephyr-attribution-demo
```

The built CLI/SDK and real loopback HTTP fixture verify tier defaults, independent
content flags, local isolation, build IDs, stable retry identity, rejected
acknowledgments/redirects, and private restrictions. The verifier restores shared
config and writes a private `storage-test-report.json`. Production authorization,
encryption, retention, and BYOC routing require separate server verification.
