# Rsbuild + Module Federation Enhanced + Zephyr

## Build:

Build the provider first, then the consumer:

```bash
pnpm --filter mf-react-rsbuild-provider run build
pnpm --filter mf-react-rsbuild run build
```

Or use the root script (uses NX for proper dependency ordering):

```bash
pnpm run build:all
```

Or use NX directly:

```bash
nx run-many -t build -p mf-react-rsbuild-provider mf-react-rsbuild
```

## Serve:

Start the provider first (on port 3000), then the consumer (on port 2000):

```bash
pnpm --filter mf-react-rsbuild-provider run dev
pnpm --filter mf-react-rsbuild run dev
```

Or to run both in parallel using the root script:

```bash
pnpm dev
```

## Preview:

Preview the built applications:

```bash
pnpm --filter mf-react-rsbuild-provider run preview
pnpm --filter mf-react-rsbuild run preview
```

Or to run both in parallel using the root script:

```bash
pnpm preview
```
