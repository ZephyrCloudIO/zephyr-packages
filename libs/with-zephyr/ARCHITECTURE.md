# With-Zephyr Architecture

## Overview

The `with-zephyr` package is a codemod tool that automatically adds Zephyr plugin integration to bundler configuration files. It supports 11 different bundlers and uses AST transformations to safely modify configuration files.

## Project Structure

```
libs/with-zephyr/
├── src/
│   ├── bundlers/              # 🆕 Modular bundler configurations
│   │   ├── index.ts          # Registry of all bundler configs
│   │   ├── README.md         # Documentation for bundler configs
│   │   ├── webpack.ts        # Webpack configuration
│   │   ├── rspack.ts         # Rspack configuration
│   │   ├── vite.ts           # Vite configuration
│   │   ├── rollup.ts         # Rollup configuration
│   │   ├── rolldown.ts       # Rolldown configuration
│   │   ├── rsbuild.ts        # RSBuild configuration
│   │   ├── rslib.ts          # RSLib configuration
│   │   ├── modernjs.ts       # Modern.js configuration
│   │   ├── rspress.ts        # RSPress configuration
│   │   ├── parcel.ts         # Parcel configuration
│   │   └── repack.ts         # React Native Re.Pack configuration
│   │
│   ├── tests/                 # Test files
│   │   ├── bundler-configs.test.ts
│   │   ├── codemod.test.ts
│   │   ├── package-manager.test.ts
│   │   └── transformers.test.ts
│   │
│   ├── bundler-configs.ts     # Re-export for backward compatibility
│   ├── index.ts              # Main CLI entry point
│   ├── package-manager.ts    # Package manager detection & installation
│   ├── transformers.ts       # AST transformation functions
│   └── types.ts              # TypeScript type definitions
│
├── dist/                      # Built output (ESM)
├── package.json
├── rslib.config.ts           # Build configuration
└── tsconfig.json
```

## Module Responsibilities

### 1. Bundler Configurations (`src/bundlers/`)

**Purpose**: Centralized, modular configuration for all supported bundlers.

**Benefits of Modular Structure**:

- ✅ **Consistency**: Each bundler follows the same schema
- ✅ **Maintainability**: Easy to find and modify specific bundler configs
- ✅ **Extensibility**: Add new bundlers without touching existing ones
- ✅ **Testability**: Each config can be tested in isolation
- ✅ **Documentation**: Self-contained with inline comments

**Structure**:

```typescript
// Each bundler exports a typed configuration
export const {bundler}Config: BundlerConfig = {
  files: string[],        // Config file patterns
  plugin: string,         // NPM package to install
  importName: string,     // Function to import
  patterns: [             // Transformation patterns
    {
      type: string,       // Pattern identifier
      matcher: RegExp,    // Detection regex
      transform: string   // Transform function name
    }
  ]
};
```

### 2. AST Transformers (`src/transformers.ts`)

**Purpose**: Babel-based AST transformations for code modification.

**Core Functions**:

- File I/O: `parseFile()`, `writeFile()`
- Import Management: `addZephyrImport()`, `addZephyrRequire()`
- Detection: `hasZephyrPlugin()`
- Transformations: 11 specialized transformer functions

**Key Transformers**:

```typescript
addToPluginsArray(); // Add to existing plugins array
addToPluginsArrayOrCreate(); // Create or add to plugins array
addToComposePlugins(); // Nx-style plugin composition
wrapExportDefault(); // Wrap export default
wrapModuleExports(); // Wrap CommonJS exports
addToVitePlugins(); // Vite-specific
addToRollupFunction(); // Rollup function-style
// ... and more
```

### 3. Package Manager (`src/package-manager.ts`)

**Purpose**: Intelligent package manager detection and package installation.

**Features**:

- **3-Tier Detection**:
  1. CLI user agent (`npm_config_user_agent`)
  2. Lock files and package.json
  3. Monorepo indicators
- **Universal Installation**: npm, yarn, pnpm, bun
- **Validation**: Check if packages already installed
- **Timeout Handling**: 2-minute timeout for slow networks

### 4. Main Orchestrator (`src/index.ts`)

**Purpose**: CLI interface and execution workflow coordination.

**Execution Flow**:

```
CLI Input
  ↓
1. Discovery Phase
   - Find config files via glob
   - Filter by bundler if specified
   - Detect repack vs rspack
  ↓
2. Analysis Phase
   - Parse or read files
   - Detect if already configured
   - Skip duplicates
  ↓
3. Installation Phase
   - Detect package manager
   - Install missing plugins
   - Handle errors gracefully
  ↓
4. Transformation Phase
   - Detect pattern for each file
   - Parse to AST
   - Apply transformer
   - Write modified file
  ↓
Summary Report
```

### 5. Type System (`src/types.ts`)

**Purpose**: TypeScript type definitions for type safety.

**Key Types**:

```typescript
BabelNode; // Babel AST node
BundlerPattern; // Pattern configuration
BundlerConfig; // Bundler configuration
BundlerConfigs; // Registry of all configs
ConfigFile; // Discovered file metadata
CodemodOptions; // CLI options
TransformFunction; // AST transformation signature
PackageManager; // Supported package managers
```

## Architecture Patterns

### 1. Strategy Pattern

Each bundler defines its transformation strategy through patterns.

```typescript
const TRANSFORMERS: TransformFunctions = {
  addToPluginsArray,
  addToComposePlugins,
  // ... strategies mapped by name
};
```

### 2. Registry Pattern

Centralized registration of bundlers and transformers.

```typescript
export const BUNDLER_CONFIGS: BundlerConfigs = {
  webpack: webpackConfig,
  vite: viteConfig,
  // ... all bundlers registered
};
```

### 3. Visitor Pattern

Babel traverse uses visitors for AST walking.

```typescript
traverse(ast, {
  CallExpression(path) {
    // Visit and modify call expressions
  },
  ObjectProperty(path) {
    // Visit and modify object properties
  },
});
```

### 4. Chain of Responsibility

Pattern matching tries patterns in order until one matches.

```typescript
for (const pattern of config.patterns) {
  if (pattern.matcher.test(content)) {
    return pattern; // First match wins
  }
}
```

## Data Flow

### Complete Example: RSPress Config Transformation

```typescript
// 1. User Command
$ with-zephyr

// 2. Discovery
findConfigFiles('./')
→ Finds: ./rspress.config.ts
→ Creates ConfigFile object

// 3. Analysis
checkHasZephyr('./rspress.config.ts')
→ parseFile() → AST
→ hasZephyrPlugin(ast) → false
→ Include in processing

// 4. Package Installation
detectPackageManager('./')
→ Returns: 'pnpm'

installPackage('zephyr-rspress-plugin')
→ Runs: pnpm add --save-dev zephyr-rspress-plugin

// 5. Pattern Detection
detectPattern(file, rspressConfig)
→ Tests: /defineConfig\s*\(\s*\{/ → MATCH
→ Transform: 'addToPluginsArrayOrCreate'

// 6. AST Transformation
parseFile() → AST
addZephyrImport(ast)
→ Adds: import { withZephyr } from "zephyr-rspress-plugin"

addToPluginsArrayOrCreate(ast)
→ Finds: defineConfig({ ... })
→ No plugins array found
→ Adds: plugins: [withZephyr()]

writeFile() → Modified file

// 7. Result
✓ Processed: 1
```

## Testing Strategy

### Test Coverage

- **101 total tests**
- Unit tests for transformers
- Integration tests for end-to-end flow
- Config validation tests
- Package manager detection tests

### Test Organization

```
tests/
├── bundler-configs.test.ts   # Config validation (35 tests)
├── package-manager.test.ts   # PM detection (25 tests)
├── transformers.test.ts      # AST transforms (17 tests)
└── codemod.test.ts           # Integration (24 tests)
```

## Extension Guide

### Adding a New Bundler

**Step 1**: Create config file `src/bundlers/newbundler.ts`

```typescript
import type { BundlerConfig } from '../types.js';

export const newBundlerConfig: BundlerConfig = {
  files: ['new.config.js', 'new.config.ts'],
  plugin: 'zephyr-new-plugin',
  importName: 'withZephyr',
  patterns: [
    {
      type: 'define-config',
      matcher: /defineConfig\s*\(\s*\{/,
      transform: 'addToPluginsArrayOrCreate',
    },
  ],
};
```

**Step 2**: Register in `src/bundlers/index.ts`

```typescript
import { newBundlerConfig } from './newbundler.js';

export const BUNDLER_CONFIGS: BundlerConfigs = {
  // ... existing configs
  newbundler: newBundlerConfig,
};

export { newBundlerConfig };
```

**Step 3**: Add tests

```typescript
describe('newBundler config', () => {
  it('should transform config', () => {
    // ... test logic
  });
});
```

**Step 4**: Update documentation

Add to `src/bundlers/README.md` and this file.

## Design Principles

1. **Modularity**: One file per bundler for clear separation
2. **Consistency**: All bundlers follow the same schema
3. **Extensibility**: Easy to add new bundlers without modifying existing code
4. **Type Safety**: Full TypeScript coverage with strict types
5. **Fail-Safe**: Graceful error handling and recovery
6. **Idempotency**: Running twice is safe (skips if already configured)
7. **Performance**: Fast string-based pattern matching before AST parsing
8. **Zero Config**: Auto-detects everything (bundler, package manager, patterns)

## Key Improvements in Modular Structure

### Before (Monolithic)

```
bundler-configs.ts (200+ lines)
  ├── All bundler configs mixed together
  ├── Hard to find specific bundler
  └── Difficult to maintain
```

### After (Modular)

```
bundlers/
  ├── index.ts (registry)
  ├── webpack.ts (27 lines)
  ├── vite.ts (23 lines)
  ├── rspress.ts (20 lines)
  └── ... (each 20-35 lines)

Benefits:
✅ Easy to locate and modify
✅ Clear ownership per bundler
✅ Consistent structure
✅ Self-documenting
✅ Better IDE navigation
✅ Easier code review
```

## Performance Characteristics

- **Discovery**: O(n) where n = number of files in directory tree
- **Pattern Matching**: O(1) - simple regex on file content string
- **AST Parsing**: O(m) where m = size of config file
- **Transformation**: O(k) where k = number of AST nodes visited

**Typical Performance**:

- Small project (1-2 configs): < 3 seconds
- Medium project (5-10 configs): < 10 seconds
- Large monorepo (20+ configs): < 30 seconds

## Dependencies

### Production

- `@babel/core` - Core Babel API
- `@babel/generator` - AST → Code generation
- `@babel/parser` - Code → AST parsing
- `@babel/traverse` - AST traversal
- `chalk` - Terminal colors
- `commander` - CLI framework
- `glob` - File pattern matching

### Development

- `@babel/types` - AST node types
- `@rstest/core` - Test framework
- `@rslib/core` - Build tool
- `typescript` - Type checking
- `zephyr-rsbuild-plugin` - Self-hosting (uses own plugin to build)

## Build Process

```bash
# Build with RSLib (Rspack-based)
pnpm build
  → Compiles TypeScript
  → Bundles all dependencies (autoExternal: false)
  → Outputs ESM to dist/index.js
  → Adds executable shebang (#!/usr/bin/env node)

# Result: Single self-contained ESM bundle
dist/index.js (2.2MB)
```

## Future Enhancements

- [ ] Add more bundlers (Turbopack, Bun bundler, etc.)
- [ ] Support for config file generation (when no config exists)
- [ ] Interactive mode for pattern selection
- [ ] Dry-run diff view
- [ ] Configuration file validation
- [ ] Support for ESLint-style config arrays
- [ ] Plugin options configuration
- [ ] CI/CD integration helpers

---

**Version**: 0.1.0
**License**: Apache-2.0
**Maintained by**: ZephyrCloudIO
