# SSG publication

Use this reference for post-build plugin ordering, Module Federation in SSG
builds, or output files that Zephyr rewrites before upload. It describes
behavior verified against `zephyr-rspress-plugin` 1.4.2.

## Post-build ordering

With SSG enabled, Zephyr registers a separate `zephyr-rspress-plugin-ssg`
plugin. In `beforeBuild`, it wraps the `afterBuild` hook of every plugin in the
resolved `config.plugins` list. Rspress still calls each hook once and in
parallel. Zephyr's own `afterBuild` waits for those hook promises before it
walks `outDir`, so a file written by a sitemap or search plugin listed in
`plugins` is included without reordering.

Plugins registered only through Rspress's `addPlugin` utility live in a
separate internal list and are not awaited. If such a plugin generates files
that must be published, register it directly in `plugins` when its API allows.

If an awaited hook rejects, Zephyr rolls back the build and routes the error
through its global error policy: it is logged, or thrown when
`ZE_FAIL_BUILD=true`. Nothing is uploaded in either case.

The upload reads `outDir` relative to the working directory, defaulting to
`./doc_build`, and the Zephyr build context is the configured `root`.

## Module Federation in SSG builds

Rspress SSG builds a browser compiler and a Node compiler that share one output
directory. Keep federation in the site's existing Rsbuild-level configuration;
Zephyr adds an internal Rsbuild plugin that runs after federation plugins are
materialized and:

- collects Module Federation plugins from browser compilers only, so the Node
  compiler does not publish a second metadata record for the same container;
- for browser compilers that expose modules with an absolute `http(s)` public
  path, switches `output.publicPath` to `auto`. The Node compiler keeps its
  absolute public path.

Every emitted file is still uploaded, including Node and SSG artifacts.

## Output rewritten before upload

When `outDir` contains a root `mf-manifest.json`, Zephyr edits files in place
before uploading them:

- `href`/`src` attributes in emitted HTML that point at emitted files through
  an absolute URL become relative paths. Third-party URLs are left unchanged.
- Browser and SSG manifests get `publicPath: 'auto'` and lose `ssrPublicPath`,
  except that an explicit `getPublicPath` without `publicPath` is preserved.
- If several nested SSG manifests could match, the build fails with an
  ambiguous-manifest error instead of guessing.

A `tap-app` target skips the public-path change and these rewrites, because
TAP output is locked by its SDK. Expect the local `outDir` to differ from the
raw Rspress output after a Federation SSG publish; that is not a corrupted build.
