# ze-types

Generate Module Federation types from Zephyr URLs or `zephyr:dependencies` and expose them via
`types: ["ze-types"]` in `tsconfig.json`.

## Install

```bash
pnpm add -D ze-types
```

## Generate from Zephyr URLs

```bash
npx ze-types --url https://your-app.zephyrcloud.io
```

Multiple URLs:

```bash
npx ze-types --url https://host-a.zephyrcloud.io --url https://host-b.zephyrcloud.io
```

Env:

```bash
ZE_TYPES_URLS=https://host-a.zephyrcloud.io,https://host-b.zephyrcloud.io npx ze-types
```

## Generate from zephyr:dependencies

```bash
npx ze-types
```

Or explicitly:

```bash
npx ze-types --from-package
```

Use a specific package.json:

```bash
npx ze-types --from-package --package ./apps/app-zephyr/package.json
```

Provide auth token for resolution:

```bash
ZE_SECRET_TOKEN=... npx ze-types --from-package
```

## tsconfig

```json
{
  "compilerOptions": {
    "types": ["ze-types"]
  }
}
```

## Notes

- Uses `zephyr-manifest.json` or `zephyr:dependencies` for remotes.
- Dependency resolution uses Zephyr API; set `ZE_SECRET_TOKEN` (or `ZE_AUTH_TOKEN`).
- Re-run after remote deploys to keep types fresh.
