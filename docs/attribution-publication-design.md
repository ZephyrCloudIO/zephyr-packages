---
summary: Proposes the next attribution publication contract, consent controls, and coordinated SDK release.
status: proposed
date: 2026-10-03
read_when:
  - Implementing attribution policy, remote publication, or API contract negotiation.
  - Updating attribution consent prompts, packaged guidance, or release verification.
---

# Attribution publication design

This document proposes SDK changes for the net-new attribution API. It adds no
runtime behavior, package exports, version bumps, or legal terms. Existing build
metadata and endpoints remain unchanged. Local capture remains available without
activating the remote service.

The [backend design PR](https://github.com/ZephyrCloudIO/zephyr-cloud-io/pull/3803)
owns the service security boundaries, agreement lifecycle, and legal review
requirements. [Issue 647](https://github.com/ZephyrCloudIO/zephyr-packages/issues/647)
tracks package implementation and publishing after design review. Route names,
wire schemas, supported collectors, and actual released versions must be agreed
before enablement; this document does not declare production support.

## Current implementation and required change

At baseline [PR 645](https://github.com/ZephyrCloudIO/zephyr-packages/pull/645),
commit `8bc5e110d533b39ef36d5c42e917831d03379cdf`, the
[uploader](../libs/zephyr-agent/src/lib/change-attribution/remote.ts) sends the
[version 1 evidence request](../libs/zephyr-edge-contract/src/lib/change-attribution.ts)
to Zephyr's `POST /attribution`. Authenticated policy requires patches and
structured changed lines for free remote accounts. Paid/BYOC preferences can
omit either field, but a BYOC tier does not change that upload destination.
The [existing storage guide](../skills/zephyr-core/references/attribution-storage.md)
describes that client and explicitly leaves server controls unimplemented.

The proposed protocol separates billing, destination, source authorization, and
organizational agreement acceptance. Free or paid status never requires more
source sharing. The general reporting API rejects raw evidence for every caller;
only an authorized evidence collector accepts permitted source differences.

| Mode                                 | Source destination and processing                         | Information sent to Zephyr reporting    |
| ------------------------------------ | --------------------------------------------------------- | --------------------------------------- |
| Local only                           | Private checkout                                          | None required                           |
| Hosted analytics, private repository | Local/customer processor                                  | Strictly approved report and references |
| BYOC, private or OSS repository      | Customer collector, private bucket, and processor         | Approved report and verifiable receipt  |
| Hosted OSS evidence                  | Dedicated private hosted collector and isolated processor | Approved report and verifiable receipt  |

BYOC patch-only means `patch: true`, `lines: false`; it still sends source text to
the customer collector. Patches may include context and entire newly added files.
Hosted OSS additionally requires current server verification of repository
identity, public visibility, and eligibility, explicit admin authorization covering
dirty/uncommitted source, and SDK opt-in. Neither public visibility nor an `oss`
flag authorizes an upload. Prompts, transcripts, full source snapshots, and binary
contents remain outside the evidence contract.

## Publication flow

1. Apply the private checkout restriction before remote work. Local-only mode returns
   before attribution authentication or network requests. For remote mode, resolve
   the shared preferences and authenticated application/repository binding. Unknown
   configuration cannot enable sharing; an application role alone cannot grant
   repository-wide source access in a monorepo.
2. Negotiate an explicit supported capability/schema with the Zephyr control plane.
   Resolve the current destination, content ceiling, policy revision, required
   agreement/consent status, and producer permissions. Validate responses at runtime;
   TypeScript types alone do not validate a remote authorization response.
3. Intersect server permission with shared opt-in and private restrictions. A local
   preference can only reduce sharing. If agreement or source authorization is
   missing, direct an authorized person to the review flow; stop attribution
   publication while retaining local evidence and allowing deployment to continue.
4. Reserve an upload using canonical identifiers and a digest of the exact selected
   evidence bytes. The server binds the reservation to the authenticated uploader,
   organization, repository, application, build/snapshot, fingerprint, digest,
   content selection, destination, policy revision, and acceptance references.
5. Send evidence directly to the approved collector using its audience-bound grant.
   Use the Zephyr bearer only for the Zephyr control plane. Require HTTPS outside
   loopback fixtures, reject redirects and credential-bearing URLs, and accept no
   custom destination or credentials from repository preferences. Customer collector
   authentication must not invoke Zephyr token invalidation or refresh on an error.
6. Register the collector's durable-storage receipt with the control plane. Only
   attach a remote reference after the server verifies the receipt and all exact
   bindings. The server reconciles a pending upload when the build is registered;
   build registration and asset publication remain separate states.
7. The authorized processor submits the approved report. BYOC processing stays in
   the customer cloud; Zephyr must not fetch source to fill in a missing report.
   An explicitly supported local reporter may submit only its allowlisted metrics,
   labeled as local/self-reported. Do not reuse the existing evidence body as a
   report, even when both source-text preferences are false.

Neither the reporting runtime nor the SDK gets a product raw-download flow. The
SDK must not upload evidence into deployment assets, general metadata, diagnostics,
or a fallback hosted destination. This requirement concerns the new attribution
flow; it does not introduce restrictions on existing metadata.

## Contract boundaries and retries

| Contract concept         | Required meaning                                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Effective policy         | Server-owned repository/application scope, destination, content ceiling, current agreement/consent references, and revision; billing remains independent               |
| Upload reservation/grant | Opaque retry identity and narrowly scoped, expiring authority for one destination and the exact evidence operation                                                     |
| Evidence request         | Versioned allowlist of approved differences and evidence fields; distinct from reporting                                                                               |
| Storage receipt          | Verifiable proof of durable storage with identity, ownership, content/digest, policy, and acceptance bindings; not an authorship or deployment certificate             |
| Report                   | Bounded approved metrics, canonical identifiers/references, provenance, and disclosure version; no raw paths, arbitrary metadata, source text, or session/prompt dumps |

The current retry key hashes application, repository, and numeric build ID. The
backend design identifies per-user build counters, so use the server reservation
instead of treating those three values as globally unique. Exact retries return
the original result; altered content or ownership conflicts. Preserve the local
delivery record and immutable source receipt separately. Do not recapture different
bytes and reuse a reservation after an ambiguous upload timeout. Resolve or retry
the same operation through the authenticated protocol; a digest mismatch cannot
be treated as success.

Agreement revocation, stale policy, or changed destination requires fresh server
authorization, not an automatic retry against another endpoint. Outstanding grants
and queued processor jobs are subject to the backend's current-policy checks.

## Agreements, consent, and reporting notices

The backend resolves the applicable standard or custom organization agreement
profile, immutable document versions, and separate source authorization. The SDK
consumes that decision; repository JSON cannot substitute contract text, a tier,
an `accepted: true` flag, or another organization's acceptance identifier.

An authorized human reviews and affirmatively accepts the applicable terms, or the
server registers a verified signed agreement. CI, an agent, an environment variable,
or generic CLI `--yes` cannot provide that acceptance. Organization contract
authority and repository source-policy authority are separate permissions. An
organization's acceptance must not be described as an individual contributor's
privacy consent.

Show the approved description of content, destination, purpose, readers, retention,
and withdrawal/deletion behavior before source opt-in. Broader sharing requires
renewed server-approved authorization. Proposed policy errors include
`ATTRIBUTION_AGREEMENT_REQUIRED` and `ATTRIBUTION_CONSENT_REQUIRED`; their final
schemas belong to the reviewed shared contract. Expose a safe authenticated review
link, not confidential contract text or acceptance proof in logs.

Reports carry the approved disclosure version and provenance labels. UI and export
consumers must explain incomplete/self-reported capture, unknown origins, and
cumulative or estimated costs. Unknown is not human; cumulative session snapshots
are not additive per line or repeated observation. Neither reports nor signed
receipts certify authorship, IP ownership, license compliance, employee productivity,
or deployment completion. BYOC guidance must accurately describe customer and
Zephyr responsibilities rather than promise zero Zephyr liability.

Counsel-reviewed attribution terms, custom agreement precedence, BYOC responsibility
allocation, contributor notices/data-processing terms, and final disclaimers are
enablement prerequisites in the backend design. This proposal does not set a
liability cap or publish binding legal wording.

## Compatibility and failure behavior

| Condition                                                                      | Required client behavior                                                          |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Legacy/missing/unknown capability or schema                                    | No new source publication; retain local evidence and continue deployment          |
| Missing/expired/revoked acceptance or source authorization                     | Surface authorized human review; do not auto-accept or attach a new reference     |
| Private override, stale OSS verification, or reduced server content permission | Stop affected sharing; never infer expanded permission from a public repo or tier |
| BYOC outage, redirect, or collector authorization failure                      | No hosted fallback and no Zephyr bearer forwarding; local retention               |
| Reporting rejects source, including `SOURCE_CONTENT_NOT_ALLOWED`               | Fixed safe diagnostic; do not strip fields and claim evidence was stored          |
| Timeout or mismatched receipt/digest                                           | No unacknowledged reference; exact retry/status reconciliation only               |
| Failed deployment after evidence upload                                        | Preserve truthful pending status; backend orphan cleanup handles retention        |

Legacy version 1 evidence requests must not be redirected or aliased to an
analytics-only endpoint. A compatibility adapter would require its own review;
silently reinterpreting `storage: remote` or `tier: byoc` is not migration.

## Package ownership and release sequence

| Package or surface                      | Implementation work after review                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `zephyr-edge-contract`                  | New versioned policy, grant, receipt, report, agreement-status, disclosure, and fixed-error contracts plus capability negotiation           |
| `zephyr-agent`                          | Runtime validation, direct collector transport with isolated credentials, reservations/retries, receipt handling, and deployment continuity |
| `zephyr-cli` and `with-zephyr`          | Independent content/destination preferences, effective-policy status and human review notices; no implicit legal acceptance                 |
| Shared and package-owned skills/READMEs | Replace tier-driven guidance when the compatible implementation ships; document actual supported capabilities and approved disclosures      |
| Verification scripts and tests          | Real HTTP/collector fixtures for credential boundaries, content selection, safe errors, conflicts, and consent lifecycle                    |

1. Approve both designs and freeze the initial report producer/schema, capability
   version, collector provisioning/verification rules, limits, and lifecycle states.
2. Land backend support with new capabilities disabled; do not issue legacy policy
   that invites source into an analytics-only endpoint.
3. Implement and verify the shared contract and consumers together. Update the
   existing storage and change-attribution verification scripts and packaged guides.
4. Publish through the existing [release process](releasing.md). Record the actual
   package versions and backend dependency update; merging this design does not
   publish packages or upgrade existing consumers.
5. Enable selected repositories only after compatible clients, required legal
   acceptance, and collector/processor isolation checks pass. Rollback disables new
   grants/publication without expanding sharing or discarding retention obligations.

Issue 647 stays open until implementation and release evidence exist. No version
bump, generated client change, or packaging change is needed for this design PR.

## Implementation acceptance checks

- Exercise a real HTTP fixture for BYOC patch-only: patch text reaches only the
  customer collector, structured lines are absent, and Zephyr sees only approved
  requests/reports/receipts. Include free and paid billing states.
- Assert bearer audience isolation, redirect refusal, and no source/request bodies
  or private acceptance proof in success, failure, scanner, or retry diagnostics.
- Cover missing/stale/revoked and cross-tenant acceptance references, expanded
  consent scope, CI/generic confirmation attempts, and revocation between grant,
  upload, and processing. The backend must enforce these independently of the SDK.
- Cover two users with the same build counter, changed snapshots/digests, concurrent
  identical retries, partial finalization, and an upload followed by failed deployment.
- Reject unknown schemas and nested source fields in reports, including for OSS
  users. Missing capability/authorization/receipt must preserve normal deployment
  and attach no unsupported attribution reference.
- Verify unknown provenance, non-additive cumulative cost handling, and disclosure
  references through report/UI/export consumers. Customer-cloud routing, IAM,
  retention, and actual server isolation need integration evidence beyond mocks.

For this design-only change, validate formatting, local links, source comparisons,
and the repository's documentation/skill review. Ephemeral environment: **not
needed**; reassess deployed integration testing when implementation starts.
