# Transformer Functions

This directory contains AST transformation functions organized by category. Each transformer safely modifies bundler configuration files to add Zephyr plugin integration.

## Directory Structure

```
transformers/
├── index.ts           # Main exports (re-exports all transformers)
├── README.md          # This file
├── core.ts            # Core utilities (file I/O, detection)
├── imports.ts         # Import/require management
├── plugins-array.ts   # Plugin array transformers
├── vite.ts            # Vite-specific transformers
├── rollup.ts          # Rollup-specific transformers
├── wrappers.ts        # Wrapper transformers
└── json.ts            # JSON config transformers
```

## Categories

### 1. Core Utilities (`core.ts`)

**Purpose**: Foundation for all AST transformations

**Functions**:

- `parseFile(filePath)` - Parse JS/TS file to Babel AST
- `writeFile(filePath, ast)` - Generate code from AST and write to file
- `hasZephyrPlugin(ast)` - Check if withZephyr is already present
- `skipAlreadyWrapped(ast)` - No-op transformer for pattern matching

**Usage**:

```typescript
const ast = parseFile('./vite.config.ts');
if (!hasZephyrPlugin(ast)) {
  // Apply transformation
  writeFile('./vite.config.ts', ast);
}
```

---

### 2. Import Management (`imports.ts`)

**Purpose**: Add import or require statements for withZephyr

**Functions**:

- `addZephyrImport(ast, pluginName, importName)` - Add ESM import
- `addZephyrRequire(ast, pluginName, importName)` - Add CommonJS require

**Behavior**:

- Checks if import/require already exists
- Places imports after first existing import or at top
- Handles both named imports and CommonJS destructuring

**Example Transformations**:

ESM:

```typescript
// Before
import { defineConfig } from 'vite';

// After
import { defineConfig } from 'vite';
import { withZephyr } from 'vite-plugin-zephyr';
```

CommonJS:

```typescript
// Before
const path = require('path');

// After
const { withZephyr } = require('vite-plugin-zephyr');
const path = require('path');
```

---

### 3. Plugin Array Transformers (`plugins-array.ts`)

**Purpose**: Add withZephyr to plugins arrays or create them

**Functions**:

#### `addToPluginsArray(ast)`

Adds to existing plugins array anywhere in the config.

```typescript
// Before
export default {
  plugins: [react()],
};

// After
export default {
  plugins: [react(), withZephyr()],
};
```

#### `addToPluginsArrayOrCreate(ast)`

Smart transformer that creates plugins array if needed.

```typescript
// Before (no plugins)
export default defineConfig({
  root: './src',
});

// After
export default defineConfig({
  root: './src',
  plugins: [withZephyr()],
});

// OR if plugins exist
export default defineConfig({
  plugins: [existing()],
  root: './src',
});

// After
export default defineConfig({
  plugins: [existing(), withZephyr()],
  root: './src',
});
```

**Used by**: RSPress, Rolldown, Modern.js

#### `addToComposePlugins(ast)`

Adds to Nx-style plugin composition.

```typescript
// Before
export default composePlugins(withNx(), withReact(), (config) => config);

// After
export default composePlugins(withNx(), withReact(), withZephyr(), (config) => config);
```

**Used by**: Webpack (Nx), Rspack (Nx)

---

### 4. Vite Transformers (`vite.ts`)

**Purpose**: Handle Vite-specific configuration patterns

**Functions**:

#### `addToVitePlugins(ast)`

Simple wrapper around `addToPluginsArray`.

#### `addToVitePluginsInFunction(ast)`

Handles arrow function configs.

```typescript
// Before
export default defineConfig(() => ({
  plugins: [react()],
}));

// After
export default defineConfig(() => ({
  plugins: [react(), withZephyr()],
}));
```

**Used by**: Vite

---

### 5. Rollup Transformers (`rollup.ts`)

**Purpose**: Handle Rollup-specific configuration patterns

**Functions**:

#### `addToRollupFunction(ast)`

Handles function-style configs.

```typescript
// Before
module.exports = (config) => {
  // modifications
  return config;
};

// After
module.exports = (config) => {
  config.plugins.push(withZephyr());
  return config;
};
```

#### `addToRollupArrayConfig(ast)`

Handles array-style configs.

```typescript
// Before
export default [
  {
    input: 'src/index.ts',
    plugins: [resolve(), babel()],
  },
];

// After
export default [
  {
    input: 'src/index.ts',
    plugins: [resolve(), babel(), withZephyr()],
  },
];
```

**Used by**: Rollup

---

### 6. Wrapper Transformers (`wrappers.ts`)

**Purpose**: Wrap entire exports with withZephyr

**Functions**:

#### `wrapModuleExports(ast)`

Wraps CommonJS exports.

```typescript
// Before
module.exports = { mode: 'development' };

// After
module.exports = withZephyr();
```

**Used by**: Webpack, Rspack (legacy configs)

#### `wrapExportDefault(ast)`

Wraps object exports.

```typescript
// Before
export default { mode: 'development' };

// After
export default withZephyr()({ mode: 'development' });
```

**Used by**: Rspack (simple configs)

#### `wrapExportedFunction(ast)`

Wraps function references.

```typescript
// Before
const config = (env) => ({ mode: env.mode });
export default config;

// After
const config = (env) => ({ mode: env.mode });
export default withZephyr()(config);
```

**Special handling**: Skips conditional exports that already have withZephyr:

```typescript
// This pattern is NOT modified
export default USE_ZEPHYR ? withZephyr()(config) : config;
```

**Used by**: Re.Pack (React Native)

---

### 7. JSON Transformers (`json.ts`)

**Purpose**: Handle JSON configuration files (non-AST)

**Functions**:

#### `addToParcelReporters(filePath, pluginName)`

Modifies Parcel's JSON config directly.

```json
// Before
{
  "reporters": ["@parcel/reporter-cli"]
}

// After
{
  "reporters": [
    "@parcel/reporter-cli",
    "parcel-reporter-zephyr"
  ]
}
```

**Used by**: Parcel

---

## Common Patterns

### Pattern 1: Plugin Array

Most bundlers use `plugins: []` array:

```typescript
addToPluginsArray(ast); // If array exists
// OR
addToPluginsArrayOrCreate(ast); // Creates if needed
```

### Pattern 2: Composition

Some use function composition:

```typescript
addToComposePlugins(ast);
```

### Pattern 3: Wrapping

Some configs need full wrapping:

```typescript
wrapExportDefault(ast); // For objects
wrapModuleExports(ast); // For CommonJS
wrapExportedFunction(ast); // For functions
```

## Adding a New Transformer

### Step 1: Choose Category

Determine which file your transformer belongs in:

- General plugin array? → `plugins-array.ts`
- Bundler-specific? → Create new file or add to existing
- Wrapper pattern? → `wrappers.ts`

### Step 2: Write Transformer

```typescript
// In appropriate file
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { BabelNode } from '../types.js';

export function myNewTransformer(ast: BabelNode): void {
  traverse(ast, {
    // Visitor pattern
    CallExpression(path) {
      // Check if this is the pattern we're looking for
      if (t.isIdentifier(path.node.callee, { name: 'configFunction' })) {
        // Modify the AST
        path.node.arguments.push(t.callExpression(t.identifier('withZephyr'), []));
      }
    },
  });
}
```

### Step 3: Export from Index

Add to `index.ts`:

```typescript
export { myNewTransformer } from './my-category.js';
```

### Step 4: Register in Main Index

Add to `src/index.ts`:

```typescript
const TRANSFORMERS: TransformFunctions = {
  // ... existing
  myNewTransformer,
};
```

### Step 5: Add Tests

```typescript
describe('myNewTransformer', () => {
  it('should transform pattern', () => {
    const code = `...`;
    const ast = parse(code);
    myNewTransformer(ast);
    const result = generate(ast).code;
    expect(result).toContain('withZephyr()');
  });
});
```

## Design Principles

1. **Single Responsibility**: Each transformer does one thing well
2. **Category Organization**: Related transformers grouped together
3. **Pure Functions**: No side effects except AST modification
4. **Fail-Safe**: Gracefully handle unexpected AST structures
5. **Visitor Pattern**: Use Babel traverse visitors for clarity
6. **Type Safety**: Full TypeScript types for all functions
7. **Documented**: Clear JSDoc comments explaining behavior

## AST Traversal Tips

### Finding Nodes

```typescript
traverse(ast, {
  // Match by node type
  CallExpression(path) {},
  ObjectProperty(path) {},
  ArrowFunctionExpression(path) {},
});
```

### Checking Node Types

```typescript
if (t.isIdentifier(node, { name: 'withZephyr' })) {
  // It's an identifier named 'withZephyr'
}

if (t.isCallExpression(node)) {
  // It's a function call
}
```

### Creating Nodes

```typescript
// Call expression: withZephyr()
t.callExpression(t.identifier('withZephyr'), [])

// Array: [withZephyr()]
t.arrayExpression([
  t.callExpression(t.identifier('withZephyr'), [])
])

// Object property: plugins: [...]
t.objectProperty(
  t.identifier('plugins'),
  t.arrayExpression([...])
)
```

### Modifying AST

```typescript
// Add to array
arrayNode.elements.push(newElement);

// Replace node
path.node.declaration = newExpression;

// Insert into array
path.node.body.splice(index, 0, newNode);
```

## Testing Strategy

Each transformer should have tests for:

- ✅ Basic transformation
- ✅ Already transformed (idempotency)
- ✅ Edge cases (empty arrays, missing properties, etc.)
- ✅ Different syntax styles (ESM, CommonJS, arrow functions, etc.)

## Performance Considerations

- **Fast Detection**: Check file content with regex before parsing
- **Single Pass**: Each transformer makes one AST traversal
- **Lazy Parsing**: Only parse when transformation needed
- **Efficient Visitors**: Use specific node types, not generic visitors

## Dependencies

- `@babel/parser` - Parse code to AST
- `@babel/traverse` - Walk and modify AST
- `@babel/generator` - Convert AST back to code
- `@babel/types` - AST node constructors and checks

## Resources

- [Babel AST Spec](https://github.com/babel/babel/blob/main/packages/babel-parser/ast/spec.md)
- [AST Explorer](https://astexplorer.net/) - Visualize AST structure
- [Babel Types](https://babeljs.io/docs/en/babel-types) - Node type reference
