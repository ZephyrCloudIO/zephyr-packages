---
summary: Defines Zephyr Git metadata requirements for local and CI builds.
read_when:
  - Changing Git remote parsing, CI metadata detection, or repository setup docs.
---

# Zephyr Git Usage

## Purpose

Define when Zephyr needs:

- a Git repository
- `origin` remote
- commit history

## Behavior Matrix

| Environment          | `git init` | `origin` remote | commit history | Result                                           |
| -------------------- | ---------- | --------------- | -------------- | ------------------------------------------------ |
| Local build (non-CI) | no         | no              | no             | Build can proceed with fallback metadata         |
| Local build (non-CI) | no         | no              | no             | Build can use `zephyr.config.ts`/env metadata    |
| Local build (non-CI) | yes        | yes             | no             | Build proceeds, org/project parsed from `origin` |
| Local build (non-CI) | yes        | yes             | yes            | Full Git metadata path                           |
| CI build             | no         | no              | no             | Build can use `zephyr.config.ts`/env metadata    |
| CI build             | yes        | yes             | no             | Fails (commit hash required)                     |
| CI build             | yes        | yes             | yes            | Full Git metadata path                           |

## Recommended Setup

```sh
git init
git remote add origin git@github.com:ORG/REPO.git
git add .
git commit -m "Initial commit"
```

Use this for production reliability and CI compatibility.

## Git-Decoupled Setup

Add a Zephyr config file at the project root when app identity should not come from Git. Supported file names are `zephyr.config.ts`, `zephyr.config.mts`, `zephyr.config.cts`, `zephyr.config.js`, `zephyr.config.mjs`, and `zephyr.config.cjs`.

```ts
export default {
  org: 'ORG',
  project: 'PROJECT',
  appName: 'APP',
  remoteDependencies: {
    remote: 'zephyr:remote.project.org@latest',
  },
};
```

The config file is strict: only `org`, `project`, `appName`, and `remoteDependencies` are valid fields. String fields must be strings; `remoteDependencies` must be an object with string values. Invalid config files fail the build instead of being ignored.

Equivalent environment overrides:

```sh
ZEPHYR_ORG=ORG
ZEPHYR_PROJECT=PROJECT
ZEPHYR_APP_NAME=APP
ZEPHYR_REMOTE_DEPENDENCIES='{"remote":"zephyr:remote.project.org@latest"}'
```

Environment variables win over `zephyr.config.ts`. Git remains the richest metadata source, but configured `org`/`project` let builds run without remote-origin parsing.

## Azure DevOps Setup

Azure DevOps SSH remotes are also supported:

```sh
git remote add origin git@ssh.dev.azure.com:v3/ORG/PROJECT/REPO
```

Zephyr also supports Azure DevOps SSH host aliases, legacy
`vs-ssh.visualstudio.com` SSH remotes, and `dev.azure.com` or
`*.visualstudio.com` HTTPS remotes.

Zephyr uses `ORG` as the organization and `REPO` as the project name.

## Local-Only Setup (No Commit Yet)

```sh
git init
git remote add origin git@github.com:ORG/REPO.git
```

Local build can still deploy, and Zephyr can infer org/project from `origin`.

## Notes

- In CI, commit history is required only when Git metadata is the app identity source.
- Without commits in local, Zephyr uses placeholder commit metadata (`no-git-commit`) but keeps local flow working.
- If no Git metadata is available at all, Zephyr uses `zephyr.config.ts`/env metadata when present, then falls back to global Git config, then token/user-based fallback metadata.

## Troubleshooting

If you see `Git repository not found`:

1. Confirm repository: `git rev-parse --is-inside-work-tree`
2. Confirm origin: `git remote -v`
3. For CI failures, confirm commit exists: `git rev-parse HEAD`
4. If CI still fails, ensure checkout step fetches commit history (not detached shallow state without commit metadata)
