# Remote Resolution

Use this file when the user asks how Zephyr resolves remotes, how `workspace:*` works, or which selector format to use.

## `zephyr:dependencies`

Zephyr uses the `zephyr:dependencies` field in `package.json` to map local remote names to application identifiers and resolution selectors.

Valid shapes:

```json
{
  "zephyr:dependencies": {
    "local-name": "workspace:*"
  }
}
```

```json
{
  "zephyr:dependencies": {
    "local-name": "application-uid-or-name@selector"
  }
}
```

```json
{
  "zephyr:dependencies": {
    "local-name": "zephyr:application-uid-or-name@selector"
  }
}
```

The `zephyr:` registry prefix is optional in current docs.

## Selectors to explain

- Label/tag/environment style: `@latest`, `@stable`, `@production`, `@staging`
- Semver: `@^1.2.3`, `@~2.0.0`, `@1.5.0`
- Wildcard latest: `*`
- Workspace matching: `workspace:*`

## `workspace:*`

This is the most important Zephyr-specific selector for local dev and coordinated CI.

It resolves the most recent version matching build context, including:

- git branch
- target platform
- CI vs local
- username / build identity

Why it matters:

- feature branches consume matching remotes automatically
- local dev stays isolated from CI builds
- teams do not need to hand-edit remote URLs for normal branch work

Concrete example:

- Host on branch `feature/cart`, user `alice`, local build, platform `web`
- Remote selector is `workspace:*`
- Zephyr prefers the most recent remote build that also matches `feature/cart`, `alice`, local context, and `web`
- If none exists, Zephyr falls back toward the default environment path described in the docs

What to expect if no exact match exists:

- Public docs say `workspace:*` falls back to the default environment.
- That means the remote needs at least one environment/default environment path to resolve cleanly.
- If the user sees unresolved remotes, check whether the remote app has actually been built and exposed through an environment.

## Selector guidance by scenario

| Scenario                       | Good default                                              |
| ------------------------------ | --------------------------------------------------------- |
| Branch-based local dev         | `workspace:*`                                             |
| Moving preview/staging channel | environment/tag-style selector like `@staging` or `@beta` |
| Stable production pin          | exact version like `@1.2.3`                               |
| Latest acceptable version      | `*` or an explicit moving selector, depending on policy   |

## Resolution priority note

For label-like selectors, the public docs say Zephyr resolves by looking for:

1. environment name
2. tag name
3. version name

If a user is confused by `production` or `staging`, explain that those names may resolve to an environment before they resolve to a tag.

## Best docs to link

- Remote dependencies: `https://docs.zephyr-cloud.io/features/remote-dependencies.md`
- Environment overrides: `https://docs.zephyr-cloud.io/features/environment-overrides.md`
- MF guide: `https://docs.zephyr-cloud.io/tutorials/mf-guide.md`
