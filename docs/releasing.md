---
summary: Defines stable releases managed by Release Please.
read_when:
  - Changing package versions, release workflows, or npm publishing.
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

Every push to `main` must pass the high-severity package audit before Release
Please can update its PR or create a stable tag and GitHub Release. The publish
workflow repeats the audit before npm publication.

The retired `pnpm bump-patch`, `pnpm bump-minor`, and `pnpm bump-major` flow
must not be recreated. Do not hand-create a stable tag or GitHub Release.
Manual canary and prerelease publication remain unchanged in
`publish_packages.yml`.

Release Please mints a Zephyr Workflow Automation GitHub App token from
`ZE_WORKFLOW_AUTOMATION_APP_ID` and
`ZE_WORKFLOW_AUTOMATION_PRIVATE_KEY`. The App needs contents, pull request, and
issue write access. The default `GITHUB_TOKEN` is not used because GitHub
suppresses follow-on workflow events created by it. Stable release PRs always
require human review.
