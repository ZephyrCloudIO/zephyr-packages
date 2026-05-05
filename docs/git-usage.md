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

Add a `zephyr.config.ts` file at the project root when app identity should not come from Git:

```ts
export default {
  org: 'ORG',
  parentOrg: 'PARENT_ORG',
  project: 'PROJECT',
  appName: 'APP',
  remoteDependencies: {
    remote: 'zephyr:remote.project.org@latest',
  },
  env: {
    ZE_PUBLIC_API_URL: 'https://example.com',
  },
};
```

Equivalent environment overrides:

```sh
ZEPHYR_ORG=ORG
ZEPHYR_PARENT_ORG=PARENT_ORG
ZEPHYR_PROJECT=PROJECT
ZEPHYR_APP_NAME=APP
ZEPHYR_REMOTE_DEPENDENCIES='{"remote":"zephyr:remote.project.org@latest"}'
ZEPHYR_ENV_VARS='{"ZE_PUBLIC_API_URL":"https://example.com"}'
```

Environment variables win over `zephyr.config.ts`. Git remains the richest metadata source, but configured `org`/`project` let builds run without remote-origin parsing.

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
