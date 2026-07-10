# Rspack + Module Federation Enhanced + Zephyr

## Build

Build the remote before the host:

```bash
pnpm --filter rspack_mf_remote build
pnpm --filter rspack_mf_host build
```

## Serve

Start each application in its own terminal:

```bash
pnpm --filter rspack_mf_remote serve
pnpm --filter rspack_mf_host serve
```
