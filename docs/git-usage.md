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

| Environment          | Git metadata | `origin` remote | Explicit identity | Result                                                |
| -------------------- | ------------ | --------------- | ----------------- | ----------------------------------------------------- |
| Local build (non-CI) | no           | no              | no                | Uses authenticated package/directory fallback         |
| Local build (non-CI) | yes          | no              | yes               | Uses Git history and configured app identity          |
| Local build (non-CI) | yes          | yes             | no                | Infers org/project from `origin`                      |
| CI build             | yes          | no              | yes               | Uses Git history and configured app identity          |
| CI build             | yes          | yes             | no                | Uses full Git metadata                                |
| CI build             | no           | no              | no                | Fails because stable identity metadata is unavailable |

## Recommended Setup

```sh
git init
git remote add origin git@github.com:ORG/REPO.git
git add .
git commit -m "Initial commit"
```

Use this for production reliability and CI compatibility.

## Explicit Application Identity

Add one Zephyr config file when application identity should not be inferred from the
Git remote. Supported names are `zephyr.config.ts`, `.mts`, `.cts`, `.js`, `.mjs`, and
`.cjs`.

```ts
import { defineConfig } from 'zephyr-agent';

export default defineConfig({
  org: 'my-org',
  project: 'my-project',
  appName: 'my-app',
  remoteDependencies: {
    remote: 'zephyr:remote.remote-project.remote-org@latest',
  },
});
```

The loader searches upward from the bundler's project context. The config is strict:
only `org`, `project`, `appName`, and `remoteDependencies` are accepted, and invalid or
ambiguous config files fail before a deployment starts.

Precedence is deterministic:

1. Config `org` and `project` override values inferred from `origin`.
2. Config `appName` overrides the nearest `package.json` name.
3. Config remote entries override same-named `package.json` `zephyr:dependencies`;
   package-only entries remain.

Zephyr does not read identity overrides from environment variables and never copies
project config into `process.env`. The resolved config belongs to the application
context and remains fixed for all client/server compilers and watch generations. Restart
the bundler after changing it.

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

- In CI, stable branch and commit metadata is required; explicit identity replaces
  remote-origin inference, not deployment history.
- Without commits in local, Zephyr uses placeholder commit metadata (`no-git-commit`) but keeps local flow working.
- If no Git metadata is available at all, Zephyr falls back to global Git config, then token/user-based fallback metadata.
- In CI with `ZE_CI_TOKEN`, Zephyr infers the build actor in the plugin. GitLab reads built-in `CI_JOB_TOKEN` JWT
  claims locally, then falls back to GitLab's `/job` API from the runner and GitLab's predefined `GITLAB_USER_EMAIL` for
  legacy/non-JWT job tokens. GitHub Actions reads `GITHUB_EVENT_PATH` commit/pusher emails, then falls back to GitHub
  noreply email from `GITHUB_ACTOR_ID` and `GITHUB_ACTOR`. No GitLab/GitHub CI YAML changes are required beyond setting
  `ZE_CI_TOKEN`. Legacy `ZE_SERVER_TOKEN` behavior is unchanged.

## Troubleshooting

If you see `Git repository not found`:

1. Confirm repository: `git rev-parse --is-inside-work-tree`
2. Confirm origin: `git remote -v`
3. For CI failures, confirm commit exists: `git rev-parse HEAD`
4. If CI still fails, ensure checkout step fetches commit history (not detached shallow state without commit metadata)
