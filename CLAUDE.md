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
