---
summary: Defines `tap-app` as an opaque Zephyr build target.
read_when:
  - Changing supported build targets or target forwarding.
  - Publishing static assets with the `tap-app` target.
---

# `tap-app` build target

`tap-app` is a first-class Zephyr build-target value. Like `web`, `ios`, and
`android`, it labels a build and its immutable snapshot; it does not select a
package protocol or product-specific control plane.

Public adapters accept the target through their normal configuration surface:

```ts
withZephyr({ target: 'tap-app' });
```

The agent validates the target value and forwards it through dependency
resolution, build stats, and snapshot metadata. All asset collection, path
normalization, base-path handling, SSR selection, manifest generation, and
Module Federation metadata handling use the same generic code paths as other
targets.

The agent does not parse package descriptors or locks, require target-specific
Federation metadata, infer release identity, or implement Marketplace,
installation, update, or runtime policy. Callers supply ordinary static assets
and explicitly configure ordinary adapter options such as CSR or SSR behavior.

Product consumers remain responsible for interpreting any files published in a
`tap-app` snapshot.
