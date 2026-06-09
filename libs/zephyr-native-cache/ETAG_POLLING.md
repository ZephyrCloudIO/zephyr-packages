# Zephyr Manifest ETag Polling

`zephyr-native-cache` uses remote `zephyr-manifest.json` ETags as the polling invalidation signal.

## Flow

1. The Module Federation runtime plugin still registers remote bundle URLs and bundle hashes during remote resolution.
2. For every remote MF manifest URL, native-cache derives the colocated `zephyr-manifest.json` URL.
3. Native-cache performs its own baseline request for that `zephyr-manifest.json` and stores `{ etag, manifest }` in `globalThis.__ZEPHYR__.runtime.manifests` keyed by URL. `manifest` is the parsed response body.
4. Polling sends `If-None-Match` with the stored ETag.
5. `304 Not Modified` means the remote runtime manifest did not change, so native-cache skips bundle manifest parsing and pre-download work.
6. `200 OK` with a different ETag means the remote runtime manifest changed. Native-cache updates the stored ETag and runs the existing update path for that remote's known MF bundles.

## Scope

This is remote-focused. Host app assets are not downloaded through native-cache; relative bundle paths continue through the existing fallback path.

The ETag is not used as a JS bundle checksum. Bundle hashes from the MF manifest remain the verification input when native-cache downloads and saves a bundle. The ETag only decides whether polling should treat a remote runtime manifest as changed.

## Worker Requirements

Zephyr-hosted assets must expose `ETag`, allow `If-None-Match`, and return `304 Not Modified` when the client's validator matches the current asset hash. This lets polling avoid downloading the `zephyr-manifest.json` body when nothing changed.
