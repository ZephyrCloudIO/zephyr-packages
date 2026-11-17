# With-Zephyr Architecture

## Overview

`with-zephyr` is a codemod CLI that adds Zephyr integration to supported project config files.

Transformations parse configs with **`@swc-next/parser`** into ESTree, index the tree with
**`@swc-next/walker`**, and rewrite source text by node span (no reprinting), so untouched code
keeps its formatting and comments.
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
│   │   └── ast.ts             # swc-next parse, parent index, AST predicates, text edits
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
└── rslib.config.mts
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

1. Try one or more rewrite attempts against the parsed file.
2. Return `changed`, `no-match`, or `error`.
3. Respect bundler strategy:
   - `first-success`: stop after first `changed`
   - `run-all`: apply all and aggregate

### AST Engine

`src/engine/ast.ts` is the shared layer over swc-next:

- `parseFile` / `parseSource`: language and source type come from the file path
  (`langFromPath` / `sourceTypeFromPath`); syntax errors throw
- `ParsedSource`: one walker pass records every node and its parent, so `parent`,
  `ancestors`, and `ofType` queries never re-walk the tree
- ESTree predicates such as `isCallTo`, `isKeyValueProperty`, and `isModuleExportsAssignment`
- `applyEdits`: splice `{ start, end, text }` edits into the original source

`@swc-next/parser` is a native napi package and must stay external in `rslib.config.mts`;
bundled, its loader cannot find the platform binding from `dist/`.

## CLI Flow

1. Discover config files via glob patterns.
2. Filter by requested bundlers.
3. Split rspack vs repack configs.
4. Skip files already containing `withZephyr()`.
5. Install missing plugin packages (unless dry run).
6. For each file:
   - Apply bundler operations.
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
- `transformers.test.ts`: operation-level rewrite behavior
- `bundler-configs.test.ts`: bundler schema validity and expected defaults
- `package-manager.test.ts`: package manager and install detection behavior

## Dependencies

Primary runtime dependencies:

- `@swc-next/parser`
- `@swc-next/walker`
- `chalk`
- `commander`
- `glob`

## Design Goals

- Preserve external CLI contract.
- Keep transforms idempotent (`withZephyr` already present => skip).
- Encode bundler behavior declaratively via operation order.
- Support dry-run without mutating project files.
