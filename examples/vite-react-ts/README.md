# Vite 8 React example

This workspace exercises a TypeScript React client build with Vite 8 and
`vite-plugin-zephyr`. Its production build emits to `wwwroot` and performs a real Zephyr
upload when authentication is available.

```bash
pnpm --filter vite-react-ts dev
pnpm --filter vite-react-ts build
pnpm --filter vite-react-ts preview
```

Repository-wide formatting and linting use Oxfmt and Oxlint from the workspace root.
