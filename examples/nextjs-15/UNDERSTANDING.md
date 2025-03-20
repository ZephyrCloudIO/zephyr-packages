# Understanding NextJS with rspack and Zephyr Integration

## Current Implementation

The current implementation in `next.config.js` integrates Zephyr with NextJS using rspack:

```js
const withRspack = require('@next/plugin-rspack');
const { withZephyr } = require('zephyr-rspack-plugin');

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
};

module.exports = withZephyr()(withRspack(nextConfig));
```

## How It Works

Based on the build output, we can see that Zephyr is successfully being called during the NextJS build process:

```
in withZephyr
zephyrPluginOptions: undefined
inZephyrConfig
{}
   ▲ Next.js 15.3.0-canary.15

   Creating an optimized production build ...
in withZephyr
zephyrPluginOptions: undefined
inZephyrConfig
{}
 ZEPHYR   Hi zackary_chapple!
 ZEPHYR   next15canarywithrspackandzephyr.next-js.vercel#1747
 ZEPHYR
 ZEPHYR   Hi zackary_chapple!
 ZEPHYR   next15canarywithrspackandzephyr.next-js.vercel#1748
 ZEPHYR
in withZephyr
zephyrPluginOptions: undefined
inZephyrConfig
{}
in withZephyr
zephyrPluginOptions: undefined
inZephyrConfig
{}
 ZEPHYR   Hi zackary_chapple!
 ZEPHYR   next15canarywithrspackandzephyr.next-js.vercel#1749
 ZEPHYR
```

## Why Multiple Compiler Instances?

NextJS creates multiple webpack/rspack compiler instances during a build process:

1. **Server Compiler**: Used to build server-side code
2. **Edge Server Compiler**: Used for edge runtime code (middleware, edge API routes)
3. **Client Compiler**: Used for client-side code

This is evident in the build system code, particularly in `webpack-build/impl.ts`:

```typescript
// We run client and server compilation separately to optimize for memory usage
let clientResult: SingleCompilerResult | null = null;
let serverResult: UnwrapPromise<ReturnType<typeof runCompiler>>[0] | null = null;
let edgeServerResult: UnwrapPromise<ReturnType<typeof runCompiler>>[0] | null = null;

if (!compilerName || compilerName === 'server') {
  debug('starting server compiler');
  const start = Date.now();
  [serverResult, inputFileSystem] = await runCompiler(serverConfig, {
    runWebpackSpan,
    inputFileSystem,
  });
  debug(`server compiler finished ${Date.now() - start}ms`);
}

if (!compilerName || compilerName === 'edge-server') {
  debug('starting edge-server compiler');
  const start = Date.now();
  [edgeServerResult, inputFileSystem] = edgeConfig ? await runCompiler(edgeConfig, { runWebpackSpan, inputFileSystem }) : [null];
  debug(`edge-server compiler finished ${Date.now() - start}ms`);
}

// ... then later runs the client compiler
if (!compilerName || compilerName === 'client') {
  debug('starting client compiler');
  const start = Date.now();
  [clientResult, inputFileSystem] = await runCompiler(clientConfig, {
    runWebpackSpan,
    inputFileSystem,
  });
  debug(`client compiler finished ${Date.now() - start}ms`);
}
```

### Deeper Look at Multi-Compiler Architecture

From examining the complete `webpack-build/impl.ts` file, we can see that Next.js follows a specific strategy with its multiple compilers:

1. **Sequential Compilation**: The compilers run one after another in a specific order (server → edge-server → client) to optimize for memory usage
2. **Compiler Data Sharing**: The server compilers run first to track the boundaries between server and client components:

   ```typescript
   // Only continue if there were no errors
   if (!serverResult?.errors.length && !edgeServerResult?.errors.length) {
     const pluginState = getPluginState();
     for (const key in pluginState.injectedClientEntries) {
       const value = pluginState.injectedClientEntries[key];
       const clientEntry = clientConfig.entry as webpack.EntryObject;
       // Add server component entries to client compilation
     }
     // ... then run client compiler
   }
   ```

3. **Shared File System**: The compilers share a common input file system to improve performance:

   ```typescript
   let inputFileSystem: webpack.Compiler['inputFileSystem'] | undefined;
   // This is passed between compiler runs and finally purged at the end
   inputFileSystem?.purge?.();
   ```

4. **Memory Optimizations**: When enabled, Next.js uses string buffer optimizations:
   ```typescript
   if (config.experimental.webpackMemoryOptimizations) {
     stringBufferUtils.disableDualStringBufferCaching();
     stringBufferUtils.enterStringInterningRange();
   }
   // ...
   if (config.experimental.webpackMemoryOptimizations) {
     stringBufferUtils.exitStringInterningRange();
   }
   ```

This explains why we see multiple Zephyr instances and initialization messages during the build process. Each compiler instance loads its configuration independently, which means:

1. The `withZephyr()` wrapper is applied multiple times, once for each compiler
2. Each time, Zephyr initializes and authenticates, generating a unique build ID
3. This is why we see "Hi zackary_chapple!" multiple times with different build IDs (#1747, #1748, #1749)
4. Each compiler's configuration is generated from the base config (`getBaseWebpackConfig`), which includes applying all custom config wrappers like our Zephyr integration

## Comparison with Working Example

When comparing the output to a working Zephyr example in the react-vite-mf/rspack project, we can see key differences:

```
 ZEPHYR   Hi zackary_chapple!
 ZEPHYR   vite-rspack.zephyr-examples.zackarychapple#1752
 ZEPHYR
 ZEPHYR   Uploaded ci snapshot in 205ms
 ZEPHYR   (2/15 assets uploaded in 212ms, 16.19kb)
 ZEPHYR   Deployed to Zephyr's edge in 534ms.
 ZEPHYR
 ZEPHYR   https://zackary-chapple-1752-vite-rspack-zephyr-examples--d441493df-ze.zephyrcloud.app
```

The main differences are:

1. **Asset Uploads**: The working example shows `(2/15 assets uploaded in 212ms, 16.19kb)` while our NextJS integration doesn't show any asset uploads
2. **Edge Deployment**: The working example reports `Deployed to Zephyr's edge in 534ms` while our integration doesn't
3. **Deployment URL**: The working example generates a public URL while our integration doesn't

## Configuration Order

The key insight is that the configuration order matters. In the working solution:

```js
module.exports = withZephyr()(withRspack(nextConfig));
```

This applies `withZephyr()` as the outermost wrapper, which is then applied to the result of `withRspack(nextConfig)`. This is different from our earlier attempts where we tried to use the NextJS webpack configuration hooks.

Even though it might seem counterintuitive, this order works because:

1. The `withZephyr()` function is designed to work with both rspack and NextJS configurations
2. When applied as the outermost wrapper, it can properly intercept and modify the configuration before it's passed to the NextJS build system

## Completing the Integration

To fully match the working example, we need to:

1. **Configure Build Output**: Ensure that the build output is in a format that Zephyr can recognize and upload:

```js
const nextConfig = {
  output: 'export', // Generate static output
  distDir: 'out', // Use a specific output directory
  // ... other config
};
```

2. **Adjust Zephyr Options**: Pass options to the Zephyr plugin to match the working example:

```js
module.exports = withZephyr({
  // Options might include deployment settings
})(withRspack(nextConfig));
```

## Benefits of the Integration

When successfully integrated, Zephyr with NextJS + rspack provides:

1. **Build Tracking**: Assigns unique IDs to track builds
2. **Edge Deployment**: Deploys assets to Zephyr's edge network for improved performance
3. **Public URL Generation**: Creates a unique public URL for accessing the application

## How Environment Variables Control the Build Process

The integration between Next.js, Rspack, and Zephyr relies heavily on environment variables to control the build process:

1. **Environment Variables Set by withRspack**:

   - `process.env.NEXT_RSPACK = 'true'` - The main flag that triggers Rspack usage
   - `process.env.RSPACK_CONFIG_VALIDATE = 'loose-silent'` - Configures Rspack validation behavior

2. **How These Variables Affect the Build**:

   - `NEXT_RSPACK` acts as a feature flag throughout the Next.js codebase
   - When detected, Next.js loads Rspack-specific modules instead of webpack ones
   - Different plugins, loaders, and configurations are used based on this variable
   - Error messages and telemetry are adjusted to mention Rspack instead of webpack

3. **Specific Configuration Changes**:

   - Source maps: Uses `source-map` with Rspack rather than `eval-source-map`
   - CSS extraction: Uses Rspack-specific CSS extractors
   - Parser hooks: Skips certain webpack-specific parser hooks not available in Rspack
   - Performance tracking: Uses `rspackCompilationSpans` for telemetry

4. **Multiple Compiler Environment**:

   - Each compiler instance (server, edge-server, client) checks these environment variables
   - This explains why we see multiple Zephyr initializations with different build IDs
   - The environment variables are global, affecting all compiler instances the same way

5. **Integration with Zephyr**:
   - Zephyr detects the Rspack environment through these variables
   - It can then properly select Rspack-compatible plugins and settings
   - Each compiler instance gets its own ZephyrEngine instance
   - The environment determines how Zephyr resolves module federation configurations

## Final Assessment

The current implementation successfully initiates the Zephyr plugin during NextJS builds, with multiple instances of Zephyr being created due to NextJS's multi-compiler architecture (server, edge-server, and client).

The environment variables set by `withRspack()` are crucial for proper integration, as they control which bundler-specific code paths are taken throughout the build process. Zephyr relies on this information to properly integrate with the Rspack-based build system.

Additional configuration is needed to achieve full functionality matching the working example, with the key focus being on ensuring proper build output that Zephyr can recognize and upload to its edge network.
