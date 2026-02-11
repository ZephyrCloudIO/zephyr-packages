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
| Local build (non-CI) | yes        | yes             | no             | Build proceeds, org/project parsed from `origin` |
| Local build (non-CI) | yes        | yes             | yes            | Full Git metadata path                           |
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

## Local-Only Setup (No Commit Yet)

```sh
git init
git remote add origin git@github.com:ORG/REPO.git
```

Local build can still deploy, and Zephyr can infer org/project from `origin`.

## Notes

- In CI, commit history is required.
- Without commits in local, Zephyr uses placeholder commit metadata (`no-git-commit`) but keeps local flow working.
- If no Git metadata is available at all, Zephyr falls back to global Git config, then token/user-based fallback metadata.

## Troubleshooting

If you see `Git repository not found`:

1. Confirm repository: `git rev-parse --is-inside-work-tree`
2. Confirm origin: `git remote -v`
3. For CI failures, confirm commit exists: `git rev-parse HEAD`
4. If CI still fails, ensure checkout step fetches commit history (not detached shallow state without commit metadata)
