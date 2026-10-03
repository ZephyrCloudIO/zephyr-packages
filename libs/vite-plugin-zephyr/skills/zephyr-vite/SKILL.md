---
name: zephyr-vite
description: Configure and deploy Vite applications with vite-plugin-zephyr; use
  when adding withZephyr, configuring its Module Federation integration, or
  diagnosing Vite build publication and plugin ordering. Use the dedicated
  integrations for TanStack Start and Vinext.
metadata:
  library: vite-plugin-zephyr
  library_version: '1.5.0' # x-release-please-version
  purpose: Configure an existing Vite application for Zephyr publication while preserving its framework plugins and selecting the correct build lifecycle.
  domain: vite
  type: core
sources:
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-zephyr/src/index.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-zephyr/src/lib/vite-plugin-zephyr.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-zephyr/src/lib/vite-api.integration.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-zephyr/src/package-output.spec.ts
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-zephyr/src/lib/__fixtures__/vite-api/skill-task.md
  - ZephyrCloudIO/zephyr-packages:**/libs/vite-plugin-zephyr/README.md
---

# Configure Vite for Zephyr

## Setup

Read the application's existing Vite config and installed package versions before editing.
Keep its framework plugins and build options. If `vite-plugin-zephyr` is missing,
install it as a development dependency only when dependency changes are authorized.

Add `withZephyr()` to the existing plugin list. It returns a plugin array, so both
spreading it and nesting it in Vite's plugin list work:

```typescript
import { defineConfig } from 'vite';
import { withZephyr } from 'vite-plugin-zephyr';

export default defineConfig({
  plugins: [...withZephyr()],
});
```

The installed package supports Vite 5 through 8. Multi-environment application
publication requires Vite 7 or newer. Use `vite-plugin-tanstack-start-zephyr` or
`vite-plugin-vinext-zephyr` for those frameworks rather than replacing their
specialized integration with this generic plugin.

## Configure Module Federation

For a new federation setup, install a compatible `@module-federation/vite` peer
when authorized and pass the container config through `mfConfig`:

```typescript
import { defineConfig } from 'vite';
import { withZephyr } from 'vite-plugin-zephyr';

export default defineConfig({
  plugins: [
    ...withZephyr({
      mfConfig: {
        name: 'catalog',
        exposes: { './Product': './src/Product.tsx' },
      },
    }),
  ],
});
```

`withZephyr({ mfConfig })` installs the federation plugins itself. Do not also
add `federation(mfConfig)` for the same container. Existing configs that already
install `federation(...)` can keep that plugin and add plain `withZephyr()`;
Zephyr detects the existing federation config. The optional peer is unnecessary
for an ordinary Vite app and is required when `mfConfig` is supplied.

For hosts, keep normal federation wiring and Zephyr's `zephyr:dependencies`
mapping distinct. The `zephyr-module-federation` skill shipped in this package
covers `zephyr:dependencies`, remote resolution, and build order.

## Choose the publication lifecycle

Use the application's existing Vite build command for an ordinary client app.
When an application uses `createBuilder()` with multiple environments, publish
through `builder.buildApp()` rather than building each environment separately.

When working on SSR, multi-environment builds, explicit plugin ordering, or
separate producer builds, read [build lifecycle](references/build-lifecycle.md)
before choosing options or changing hooks.

## Avoid misleading fixes

- Do not move Zephyr universally to the end of the plugin list. It must precede
  another `enforce: 'pre'` plugin with a pre-ordered `buildApp` hook. Read the
  [build lifecycle](references/build-lifecycle.md) when resolving ordering conflicts.
- Do not use an arbitrary source filename as an SSR `entrypoint`. It must name
  an emitted server chunk relative to the snapshot root. Read the SSR entrypoint
  rules in [build lifecycle](references/build-lifecycle.md) when choosing that path.
- Do not treat a successful local asset build as proof of deployment. Check
  Zephyr publication separately, especially when errors are configured to log
  rather than fail the build.
- Do not put credentials in `ZE_PUBLIC_*`; those values are client-visible.

## Verify completion

Run the authorized build with the application's existing package runner.
Confirm its expected assets are emitted and Zephyr reports a successful
publication with a version URL. A build without credentials can establish local
asset correctness, but not live deployment success. Report that distinction.

On failure, retain the actionable error and fix the matching configuration or
publication issue. Do not silently change the framework integration, suppress
errors, or claim that a partial build was deployed.

## Optional Change Attribution

The bundled `zephyr-core/references/change-attribution.md` covers explicit
opt-in and project agent hooks. With capture enabled, Vite observes source at
`buildStart` and snapshot creation, including dirty and eligible untracked files.
Matching boundaries do not prove exact compiler inputs; changed boundaries must
be reported as such. Metadata emission does not establish cloud persistence or
dashboard support. Missing or stale Git AI evidence remains unknown.
