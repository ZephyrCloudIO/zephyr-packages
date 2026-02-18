---
title: Plugin Version DNS
summary: DNS-based plugin version warning + release-time TXT automation.
read_when:
  - Changing plugin update warning behavior
  - Updating release publish automation
---

# Plugin Version DNS

## Purpose

Use DNS TXT as a lightweight version beacon for Zephyr plugins.

- Record: `_ze_version.zephyr-cloud.io`
- Current fields: `schema`, `latest`, `msg`
- Example:
  - `schema=1; latest=1.7.3; msg=Upgrade recommended`

## Runtime Behavior (Plugin Side)

Implemented in `zephyr-agent`:

- Resolve TXT from `_ze_version.zephyr-cloud.io`
- Parse `latest` and `msg`
- Compare current plugin version vs `latest`
- If behind, log warning only (non-blocking)
- If DNS fails, ignore (best effort)

Code:

- `libs/zephyr-agent/src/lib/version-check/plugin-version-check.ts`
- Hooked from `libs/zephyr-agent/src/zephyr-engine/index.ts`

## Release Automation (CI Side)

On GitHub `release.released`, after publishing `latest`, CI updates TXT automatically.

Workflow:

- `.github/workflows/publish_packages.yml`

Script:

- `scripts/update-plugin-version-dns.js`

Script behavior:

- Infers version from GitHub tag/ref (`v1.7.3` -> `1.7.3`)
- Updates TXT record `_ze_version.zephyr-cloud.io`
- Keeps `schema` and `msg`
- Rewrites `latest`
- Removes legacy keys: `min`, `urgent`

Required GitHub secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`

## Operational Notes

- TTL currently `300` seconds
- Recommended default: keep `300` for normal release flow
- Use lower TTL only for urgent rollout messaging
