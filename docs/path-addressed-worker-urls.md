---
summary: Documents package/runtime behavior for path-addressed worker URLs.
read_when:
  - Changing Zephyr runtime manifest URL resolution, Module Federation manifest URL resolution, native cache bundle URL derivation, env import maps, or path-addressed worker URL support.
---

# Path-Addressed Worker URLs

Zephyr packages consume full URLs from Cloud. Path-addressed worker URLs must keep the route base when deriving sibling
runtime assets.

## Self Manifest URL Precedence

Web plugins resolve the application's own `zephyr-manifest.json` in this order:

1. The explicit `withZephyr({ zephyrManifestUrl })` option.
2. The selected Zephyr environment's concrete `remote_host`, with `zephyr-manifest.json` appended to that complete
   base. This preserves customer gateway mounts such as `https://cdn.example.com/customer/app/`.
3. Browser runtime inference: `document.currentScript.src` for classic scripts, then reserved
   `__zephyr/v1/{v|t|e}/...` routes exposed by `import.meta.url` for Vite ESM.
4. `/zephyr-manifest.json`, resolved against the page origin, when no canonical deployment URL is visible.

The selected environment is the engine's configured environment. Do not substitute `EDGE_URL`: it is the worker base,
not necessarily the public deployment route. Do not use Cloud's `manifest_url` either; that field identifies an
`mf-manifest.json`, not the Zephyr manifest.

Runtime inference cannot discover a hidden upstream deployment when every browser-visible URL has already been
rewritten to the page origin. It also cannot reliably distinguish an arbitrary gateway mount from a nested chunk
directory. Non-reserved ESM chunk URLs therefore keep the same-origin fallback instead of treating their directory as
the deployment root. In those cases Cloud must provide the concrete environment `remote_host`, or the application
must set `zephyrManifestUrl` explicitly.

Path mode route shape:

```text
https://edge.example.com/__zephyr/v1/v/<route-key>/remoteEntry.js
https://edge.example.com/__zephyr/v1/t/<route-key>/remoteEntry.js
https://edge.example.com/__zephyr/v1/e/<route-key>/remoteEntry.js
```

Package helpers must derive sibling assets from the deployment root. The deployment root is the reserved
`/__zephyr/v1/{v|t|e}/<route-key>` route base when the URL carries it, and the origin otherwise (hostname mode):

```text
https://edge.example.com/__zephyr/v1/e/<route-key>/zephyr-manifest.json
https://edge.example.com/__zephyr/v1/e/<route-key>/mf-manifest.json
https://edge.example.com/__zephyr/v1/e/<route-key>/chunks/main.js
```

Detect the deployment root by matching the reserved prefix, never by guessing from URL shape. Heuristics such as
"the last segment contains a dot, so it is a file" break on dotted route keys (application uids like
`app.project.org`, versions like `1.2.3`), and "use the current script's directory" breaks when bundlers nest entry
chunks (e.g. rsbuild's `static/js/`) while `zephyr-manifest.json` stays at the deployment root.

Do not use `new URL(path, base)` with an unnormalized leading slash for Zephyr sibling assets. A leading slash makes
the path origin-relative and drops `/__zephyr/v1/{v|t|e}/<route-key>`.

Allowed path-mode app assets:

- `./assets/main.js`
- `assets/main.js`
- runtime URLs derived from the current script or import URL
- bundler public path/base configured to `/__zephyr/v1/{v|t|e}/<route-key>/`

Unsupported in package runtime v1 unless the customer gateway explicitly rewrites it:

- `/assets/main.js`
- `/favicon.ico` when it is app-specific
- service worker registration above the route base
- SSR output that assumes the app owns `/`

Worker-root control routes such as `/upload`, `/__get_application_hash_list__`, `/healthz`, and `/readyz` remain
origin-root routes. This document only applies to deployable assets and runtime manifest siblings.
