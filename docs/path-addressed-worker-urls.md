---
summary: Documents package/runtime behavior for path-addressed worker URLs.
read_when:
  - Changing Zephyr runtime manifest URL resolution, Module Federation manifest URL resolution, native cache bundle URL derivation, env import maps, or path-addressed worker URL support.
---

# Path-Addressed Worker URLs

Zephyr packages consume full URLs from Cloud. Path-addressed worker URLs must keep the route base when deriving sibling
runtime assets.

Path mode route shape:

```text
https://edge.example.com/__zephyr/v1/v/<route-key>/remoteEntry.js
https://edge.example.com/__zephyr/v1/t/<route-key>/remoteEntry.js
https://edge.example.com/__zephyr/v1/e/<route-key>/remoteEntry.js
```

Package helpers must derive sibling assets from the route directory, not from the origin:

```text
https://edge.example.com/__zephyr/v1/e/<route-key>/zephyr-manifest.json
https://edge.example.com/__zephyr/v1/e/<route-key>/mf-manifest.json
https://edge.example.com/__zephyr/v1/e/<route-key>/chunks/main.js
```

Do not use `new URL(url).origin`, `protocol + host`, or `new URL(path, base)` with an unnormalized leading slash for
Zephyr sibling assets. A leading slash makes the path origin-relative and drops `/__zephyr/v1/{v|t|e}/<route-key>`.

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
