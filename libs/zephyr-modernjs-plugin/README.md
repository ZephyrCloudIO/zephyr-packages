# Zephyr ModernJS: We made application federation easy

### How to use?

The plugin requires the following configuration to work:

- Output
- HTML
- Source

```ts
export default defineConfig({
  output: {
    distPath: {
      html: './',
    },
  },
  html: {
    outputStructure: 'flat',
  },
  source: {
    mainEntryName: 'index',
  },
  runtime: {
    router: true,
  },
  plugins: [
    appTools({
      bundler: 'rspack', // Set to 'webpack' to enable webpack
    }),
    withZephyr(), // Last
  ],
});
```
