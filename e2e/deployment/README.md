# e2e-deployment

This Rstest project builds the affected, buildable examples through Turbo and
verifies the assets returned by their Zephyr production deployment URLs.

## Running deployment tests

From the repository root, run:

```bash
pnpm test:e2e
```

The command performs real uploads and therefore requires an authenticated
Zephyr session.
