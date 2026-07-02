import { defineConfig } from '@rstest/core';

/**
 * CommonJS-only packages that do not expose proper named exports when loaded as native
 * ESM (e.g. `import { init } from 'node-persist'`). Rstest externalizes everything in
 * node_modules as ESM `import`, which breaks the CJS named-import interop that bundlers
 * (webpack/rspack/tsc) provide at build time. Forcing these packages to be bundled by
 * rspack restores the same interop semantics the library has in production builds.
 */
const CJS_INTEROP_PACKAGES = new Set(['debug', 'node-persist', 'is-ci']);

export default defineConfig({
  globals: true,
  testEnvironment: 'node',
  include: ['src/**/*.{test,spec}.ts'],
  tools: {
    rspack: (config) => {
      if (Array.isArray(config.externals)) {
        config.externals = config.externals.map((external) => {
          if (typeof external !== 'function') return external;
          return (ctx: { request?: string }, callback: () => void) => {
            if (ctx.request && CJS_INTEROP_PACKAGES.has(ctx.request)) {
              // Not external: let rspack bundle it with CJS interop.
              return callback();
            }
            return (external as (c: unknown, cb: unknown) => void)(ctx, callback);
          };
        });
      }
    },
  },
});
