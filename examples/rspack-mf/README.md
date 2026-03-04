# Rspack + Module Federation + Zephyr

## Build

```bash
pnpm --filter rspack_mf_remote build
pnpm --filter rspack_mf_host build
```

Or run both:

```bash
pnpm --filter rspack-mf build-all
```

## Serve

```bash
pnpm --filter rspack_mf_remote start
pnpm --filter rspack_mf_host start
```

Or run both:

```bash
pnpm --filter rspack-mf start
```
