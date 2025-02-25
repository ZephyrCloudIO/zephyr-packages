# Zephyr Packages Development Guide

## Common Commands

- Build all libs: `nx run-many -t build --projects="libs/*"`
- Lint all libs: `nx run-many -t lint --projects="libs/*"`
- Test all libs: `nx run-many -t test --projects="libs/*"`
- Run single test: `nx test [library-name] --testFile=path/to/test.spec.ts`
- Build specific package: `nx build [library-name]`

## Code Style

- TypeScript with strict typing
- Single quotes for strings, 2-space indentation
- Use ES6+ features and async/await pattern
- Prefix Zephyr interfaces with `Ze` (e.g., `ZePluginOptions`)
- camelCase for variables/methods, PascalCase for classes/interfaces
- Document functions with JSDoc comments
- Always use explicit type annotations for function parameters
- Use descriptive variable and function names
- Handle errors explicitly with try/catch blocks
- Use absolute imports from packages, organize imports alphabetically
- Avoid side effects in functions, prefer pure functions

# Testing with Examples Repository

To test plugins against the zephyr-examples repository:

1. Build all plugins:

```bash
nx run-many -t build --projects="libs/*"
```

2. Create package tarballs:

```bash
mkdir -p dist/packages
cd libs/zephyr-webpack-plugin && npm pack && mv zephyr-webpack-plugin-*.tgz ../../dist/packages/ && cd -
cd libs/zephyr-rspack-plugin && npm pack && mv zephyr-rspack-plugin-*.tgz ../../dist/packages/ && cd -
cd libs/vite-plugin-zephyr && npm pack && mv vite-plugin-zephyr-*.tgz ../../dist/packages/ && cd -
cd libs/rollup-plugin-zephyr && npm pack && mv rollup-plugin-zephyr-*.tgz ../../dist/packages/ && cd -
cd libs/zephyr-repack-plugin && npm pack && mv zephyr-repack-plugin-*.tgz ../../dist/packages/ && cd -
```

3. Copy packages to examples repo:

```bash
cp -r dist/packages ../zephyr-examples/
```

4. Create dependency configuration file:

```bash
echo '{ "dependencies": { "zephyr-webpack-plugin": "file:packages/zephyr-webpack-plugin-*.tgz", "zephyr-rspack-plugin": "file:packages/zephyr-rspack-plugin-*.tgz", "vite-plugin-zephyr": "file:packages/vite-plugin-zephyr-*.tgz", "rollup-plugin-zephyr": "file:packages/rollup-plugin-zephyr-*.tgz", "zephyr-repack-plugin": "file:packages/zephyr-repack-plugin-*.tgz" } }' > ../zephyr-examples/plugin-deps.json
```

5. Install dependencies in examples repo:

```bash
cd ../zephyr-examples
npm install --package-lock=false .join(' '))")
```

6. Run specific examples:

```bash
cd examples/[specific-example]
npm run build
```

# Testing with Examples Repository

To test plugins against the zephyr-examples repository:

1. Build all plugins:
   \\

2. Create package tarballs:
   \zephyr-webpack-plugin-0.0.34.tgz
   zephyr-rspack-plugin-0.0.34.tgz
   vite-plugin-zephyr-0.0.34.tgz
   rollup-plugin-zephyr-0.0.34.tgz
   zephyr-repack-plugin-0.0.34.tgz\

3. Copy packages to examples repo:
   \\

4. Create dependency configuration file:
   \\

5. Install dependencies in examples repo:
   \\

6. Run specific examples:
   \\
