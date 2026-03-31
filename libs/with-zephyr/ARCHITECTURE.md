# With-Zephyr Architecture

## Overview

`with-zephyr` is a codemod CLI that adds Zephyr integration to supported project config files.

As of this version, transformations are driven by **ast-grep operations** (not Babel AST visitors).
Each bundler defines an ordered operation strategy, and the CLI applies the first successful
operation (or all operations for run-all bundlers such as RSBuild and Parcel).

## Project Structure

```
libs/with-zephyr/
├── src/
│   ├── bundlers/              # Per-bundler config definitions
│   │   ├── index.ts
│   │   ├── webpack.ts
│   │   ├── rspack.ts
│   │   ├── vite.ts
│   │   ├── rollup.ts
│   │   ├── rolldown.ts
│   │   ├── rsbuild.ts
│   │   ├── rslib.ts
│   │   ├── modernjs.ts
│   │   ├── rspress.ts
│   │   ├── astro.ts
│   │   ├── nuxt.ts
│   │   ├── parcel.ts
│   │   ├── metro.ts
│   │   └── repack.ts
│   │
│   ├── engine/
│   │   └── ast-grep.ts        # ast-grep napi runner (search/rewrite)
│   │
│   ├── operations.ts          # Operation handlers and orchestration
│   ├── package-manager.ts     # Package manager detection + installs
│   ├── nextjs-vinext.ts       # Next.js Vinext bootstrap path
│   ├── index.ts               # CLI orchestration
│   └── types.ts               # Shared types
│
│   └── tests/
│       ├── bundler-configs.test.ts
│       ├── codemod.test.ts
│       ├── package-manager.test.ts
│       └── transformers.test.ts
│
├── dist/
├── package.json
└── rslib.config.ts
```

## Core Concepts

### Bundler Strategy

Each bundler config now uses:

- `strategy`: `first-success` or `run-all`
- `operations`: ordered `BundlerOperationId[]`

Example (conceptual):

```ts
{
  strategy: 'first-success',
  operations: ['compose-plugins', 'plugins-array', 'wrap-module-exports']
}
```

### Operation Engine

`src/operations.ts` maps `BundlerOperationId` to concrete handlers.

Handler behavior:

1. Try one or more ast-grep rewrite attempts.
2. Return `changed`, `no-match`, or `error`.
3. Respect bundler strategy:
   - `first-success`: stop after first `changed`
   - `run-all`: apply all and aggregate

### ast-grep Runtime

`src/engine/ast-grep.ts` provides a small abstraction over ast-grep execution:

- Language detection (`js` / `ts` / `json`) from file path
- `searchWithAstGrep` and `rewriteWithAstGrep`
- In-process matching and rewrite using `@ast-grep/napi`
- Template-based rewrite interpolation for `$VAR` / `$$$VAR`

## CLI Flow

1. Discover config files via glob patterns.
2. Filter by requested bundlers.
3. Split rspack vs repack configs.
4. Skip files already containing `withZephyr()`.
5. Install missing plugin packages (unless dry run).
6. For each file:
   - Apply bundler operations via ast-grep.
   - Ensure import/require insertion when the integration needs one.
7. Print summary (`Processed` / `Skipped` / `Errors`).

## Type System

Important types in `src/types.ts`:

- `BundlerOperationId`
- `BundlerStrategy`
- `BundlerConfig`
- `ConfigFile`
- `OperationResult`
- `CodemodOptions`

## Testing

- `codemod.test.ts`: end-to-end CLI behavior and output summary
- `transformers.test.ts`: operation-level ast-grep behavior
- `bundler-configs.test.ts`: bundler schema validity and expected defaults
- `package-manager.test.ts`: package manager and install detection behavior

## Dependencies

Primary runtime dependencies:

- `@ast-grep/napi`
- `chalk`
- `commander`
- `glob`

## Design Goals

- Preserve external CLI contract.
- Keep transforms idempotent (`withZephyr` already present => skip).
- Encode bundler behavior declaratively via operation order.
- Support dry-run without mutating project files.
