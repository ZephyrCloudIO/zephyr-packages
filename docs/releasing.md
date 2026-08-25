---
summary: Defines stable releases and governed Renovate approval and automerge.
read_when:
  - Changing package versions, release workflows, npm publishing, Renovate, or automated PR approval.
---

# Release Automation

## Stable releases

Release Please is the only stable version, tag, and GitHub Release writer.
Conventional Commits merged to `main` update one rolling release PR:

- `fix` produces a patch release.
- `feat` produces a minor release.
- A breaking change produces a major release.

The release PR updates the root version, every package version, the three
`create-zephyr-apps` host plugin manifests, and `CHANGELOG.md`. Merging it
creates `vX.Y.Z` and the matching GitHub Release. The release event then starts
`publish_packages.yml`, which builds and publishes all packages with the npm
`latest` tag.

The retired `pnpm bump-patch`, `pnpm bump-minor`, and `pnpm bump-major` flow
must not be recreated. Do not hand-create a stable tag or GitHub Release.
Manual canary and prerelease publication remain unchanged in
`publish_packages.yml`.

Release Please uses `GH_TOKEN`, not `GITHUB_TOKEN`, because GitHub suppresses
follow-on workflow events created by the default Actions token. The credential
must be able to write contents, pull requests, and issues. Stable release PRs
always require human review.

## Governed Renovate automerge

`renovate-automerge.yml` can approve and enable squash auto-merge only when all
of these gates pass:

1. Trusted default-branch policy classifies a same-repository Renovate PR as a
   bounded dependency-only update.
2. The PR is not draft, major, breaking, blocked, superseded, oversized, or
   changing application source.
3. Claude and Codex independently return `approve` after read-only review.
4. The PR head SHA is unchanged when the approval is submitted.
5. Required repository checks pass; GitHub then completes auto-merge.

The `pull_request_target` workflow never checks out or executes Renovate's PR
head. Agent jobs receive read-only permissions and never receive `GH_TOKEN`.
The write-capable token is available only to fixed shell steps that revoke,
disarm, or submit auto-merge state. The policy is re-evaluated immediately
before approval. If a PR becomes ineligible, the workflow disables any existing
auto-merge request. Eligible runs also disarm auto-merge before review and
re-enable it only for the exact head approved by both agents.
Eligibility errors and any failed or skipped governed review chain run a final
revocation path. Revocation also dismisses earlier approvals from the
automation identity, so evaluation and agent failures fail closed even when PR
metadata changes without a new commit.

The workflow requires `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and `GH_TOKEN`.
`GH_TOKEN` must identify a collaborator or automation account allowed to review
and merge, and must not identify the Renovate PR author. Repository auto-merge
must remain enabled.

Existing Renovate PRs can be reviewed after rollout with:

```sh
gh workflow run renovate-automerge.yml -f pull_request=<number>
```

Ineligible PRs and release PRs remain human-reviewed.
