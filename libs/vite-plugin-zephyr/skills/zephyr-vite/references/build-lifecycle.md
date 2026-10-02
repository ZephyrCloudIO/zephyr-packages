# Build lifecycle

Use this reference for SSR, multiple Vite environments, ordering conflicts, or
intentionally separate producer builds. This reference describes publication
behavior of the installed `vite-plugin-zephyr` release.

## Direct builds and coordinated application builds

Ordinary `vite.build()` calls publish the direct build's output. For a
multi-environment Vite 7 or 8 builder, use `builder.buildApp()` so all current
environments contribute to one snapshot. Building the environments separately
is rejected instead of publishing incomplete snapshots.

Vite 6 does not dispatch plugin `buildApp` hooks. Its non-watch publication
supports one environment without an explicit builder configuration. Upgrade
Vite only when authorized; do not work around this limitation by silently
publishing only the client environment.

Put `withZephyr()` before plugins that combine `enforce: 'pre'` with a
pre-ordered `buildApp` hook. Direct non-watch builds also require Zephyr to observe
the final `outputOptions`, `writeBundle`, and `closeBundle` hooks. A later
post-ordered hook or unresolved asynchronous output plugin is rejected because
it could change output or fail after publication.

## SSR entrypoints

Direct SSR builds infer their emitted server entry. Set `snapshotType: 'ssr'`
and `entrypoint` only when the default inference does not express the intended
snapshot. The entrypoint is an emitted path inside the snapshot, not a source
path or an absolute filesystem path. Multiple emitted server entries require
an explicit choice.

With an emitted `server/index.mjs`, the relevant options are:

```typescript
import { withZephyr } from 'vite-plugin-zephyr';

withZephyr({
  snapshotType: 'ssr',
  entrypoint: 'server/index.mjs',
});
```

Explicit options take precedence over inference. Framework files created after
Vite returns are outside this upload lifecycle. If those files must be deployed,
the framework needs a supported post-build publication step.

## Separate producer builds

Use `withZephyrPartial()` only for intentionally separate producer invocations.
Give every producer and the finalizer the same nonempty `invocationId`, or use
the documented `ZE_BUILD_INVOCATION_ID` contract. The finalizer passes that
identity through `withZephyr({ partialBuild: { invocationId } })`.

Ambient CI metadata alone does not opt an ordinary build into partial output.
Do not invent a shared identity or reuse one across unrelated builds. A missing
identity or unavailable producer output is a failure to investigate, not a
reason to publish a reduced snapshot.

## Base paths and public configuration

Without an explicit base, the plugin defaults build assets to `./`. Existing
bases are preserved. An origin-absolute base such as `/docs/` cannot be relocated
under another deployment prefix and can produce a warning for path addressing.

This default does not make SSR HTML generation prefix-aware. Keep the dedicated
TanStack Start and Vinext integrations for their runtime HTML behavior.

`ZE_PUBLIC_*` rewrites support public runtime configuration. Never use this
mechanism to carry authentication tokens or other secrets.
