# Deployment Model

Use this file when the user asks what Zephyr builds produce, what a snapshot is, how version URLs relate to tags/envs, what the dashboard deploy model is, or how rollback/promotion works.

## Plain-English model

- Build integration creates an immutable build artifact.
- The user gets a permanent version URL for that exact build.
- Tags and environments are mutable routing layers on top of immutable builds.
- Rollback is fast because Zephyr changes pointers, not app artifacts.

## Quick glossary

| Term        | Meaning                                                        | Best use                                            |
| ----------- | -------------------------------------------------------------- | --------------------------------------------------- |
| Build       | The bundler/framework build that Zephyr observes and publishes | The starting action                                 |
| Version     | Immutable deployed build state with a permanent URL            | Exact preview, debugging, rollback target           |
| Snapshot    | Underlying stored artifact record for what was built on edge   | Internal precision when explaining architecture     |
| Tag         | Mutable named selector, rule-based or manually pinned          | Moving channel like `main`, `beta`, `stable`        |
| Environment | Mutable deployment target with config/domains/overrides        | Stable deploy target like `staging` or `production` |

## Terms

### Version

- Immutable build state.
- Has a permanent version URL.
- Good for previewing, sharing, debugging, and exact rollback targets.

### Snapshot

- Edge-side record of what was built: assets + build identity.
- In the architecture docs, snapshot and build-stats are different.
- Snapshot is the immutable artifact record; build-stats are the metadata used by the async publish flow.

Source: `https://docs.zephyr-cloud.io/reference/architecture.md`

### Tag

- Mutable named selector.
- Usually resolves to the newest matching version based on rules, but can also be pinned manually to a fixed version.
- Good for dynamic channels like `main`, `beta`, `release`, `stable`.

### Environment

- Mutable deployment target with its own config, domains, and optional overrides.
- Can point to a tag or a fixed version.
- Good for `development`, `staging`, `production`, previews, and white-label targets.
- Can also be locked/protected in stricter production workflows.

## Stage 0 vs Stage 1

Use this if the user asks why a build returns before publish work is fully done.

- Stage 0: upload files and snapshot fast; produce the version URL.
- Stage 1: async publish flow computes and updates tags/envs/cnames.
- `build-stats` acceptance does not mean every mutable target already switched.

## URLs

Version URL mental model:

```text
https://{username}-{buildId}-{app-name}-{project}-{hash}.{edge-domain}
```

Tag URL mental model:

```text
https://t-{tagname}-{app-uid}-{hash}.{domain}
```

Environment URL mental model:

```text
https://{env-name}-{app-uid}-{hash}.{domain}
```

Which URL to share:

| URL             | Share when                                                     | Why                                 |
| --------------- | -------------------------------------------------------------- | ----------------------------------- |
| Version URL     | You need an exact build preview or debugging link              | Immutable                           |
| Tag URL         | You want a moving channel like `main` or `beta`                | Follows tag resolution              |
| Environment URL | You want the stable deployment target users or QA should visit | Carries environment behavior/config |

## Dashboard workflow

- Build creates versions automatically.
- Dashboard lets users inspect versions and their metadata.
- Users create tags with matching rules.
- Users create environments that point to a tag or a fixed version.
- Promotion usually means moving an environment or tag pointer to a chosen version.
- Rollback usually means repointing back to an older known-good version.
- Tags and environments can also be locked/protected to prevent accidental changes.

## Built output notes worth calling out

- Zephyr is deployment-first and build-integrated; it observes bundler output and uploads assets after build.
- Docs describe a permanent version URL, and example/build output commonly surfaces that URL after build completes.
- The public mental model should stay on version URL first; mention snapshot internals only when useful.

## Smallest first-time path

1. Identify the stack and pick the right SDK or fallback upload path.
2. Run `with-zephyr` or add the correct Zephyr integration.
3. Build the app.
4. Start by using the version URL for exact preview/testing.
5. Add tags or environments later when the user needs moving channels or stable deploy targets.

## Correctness notes

- Do not say tags are immutable; they are not.
- Do not say environments are just aliases; they also carry config and custom-domain behavior.
- Do not say snapshot is the same thing as version URL; the URL points at the immutable build, while snapshot is the stored artifact record underneath.

## Best docs to link

- Versions: `https://docs.zephyr-cloud.io/features/versions.md`
- Tags & environments: `https://docs.zephyr-cloud.io/features/tags-environments.md`
- Instant rollbacks: `https://docs.zephyr-cloud.io/features/instant-rollbacks.md`
- Architecture: `https://docs.zephyr-cloud.io/reference/architecture.md`
- Core concepts: `https://docs.zephyr-cloud.io/reference/concepts.md`
