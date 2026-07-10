# Vite Module Federation host

This Vite host consumes the Vite, Webpack, and Rspack remotes in the sibling workspaces. It
exercises `@module-federation/vite` together with `vite-plugin-zephyr` in a federated
production build.

Start the sibling remotes before using the host in development, or build the entire
`vite-react-mf` workspace from the repository root.

```bash
pnpm --filter vite-host dev
pnpm --filter vite-remote build
pnpm --filter vite_webpack build
pnpm --filter vite_rspack build
pnpm --filter vite-host build
```

Repository-wide formatting and linting use Oxfmt and Oxlint from the workspace root.
