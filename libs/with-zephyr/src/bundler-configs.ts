import type { BundlerConfigs } from './types.js';

export const BUNDLER_CONFIGS: BundlerConfigs = {
  // Webpack configurations
  webpack: {
    files: ['webpack.config.js', 'webpack.config.ts', 'webpack.config.mjs'],
    plugin: 'zephyr-webpack-plugin',
    importName: 'withZephyr',
    patterns: [
      // Standard webpack config with composePlugins (Nx style)
      {
        type: 'compose-plugins',
        matcher: /composePlugins\s*\(/,
        transform: 'addToComposePlugins',
      },
      // Standard webpack config with plugins array
      {
        type: 'plugins-array',
        matcher: /plugins\s*:\s*\[/,
        transform: 'addToPluginsArray',
      },
      // Module.exports direct assignment
      {
        type: 'module-exports',
        matcher: /module\.exports\s*=/,
        transform: 'wrapModuleExports',
      },
    ],
  },

  // Rspack configurations
  rspack: {
    files: ['rspack.config.js', 'rspack.config.ts', 'rspack.config.mjs'],
    plugin: 'zephyr-rspack-plugin',
    importName: 'withZephyr',
    patterns: [
      {
        type: 'export-wrapped-call',
        matcher: /export\s+default\s+withZephyr\s*\(\s*\)\s*\(/,
        transform: 'skipAlreadyWrapped',
      },
      {
        type: 'compose-plugins',
        matcher: /composePlugins\s*\(/,
        transform: 'addToComposePlugins',
      },
      {
        type: 'export-default-object',
        matcher: /export\s+default\s+\{/,
        transform: 'wrapExportDefault',
      },
      {
        type: 'plugins-array',
        matcher: /plugins\s*:\s*\[/,
        transform: 'addToPluginsArray',
      },
      {
        type: 'module-exports',
        matcher: /module\.exports\s*=/,
        transform: 'wrapModuleExports',
      },
    ],
  },

  // Vite configurations
  vite: {
    files: [
      'vite.config.js',
      'vite.config.ts',
      'vite.config.mjs',
      'vite.config.mts',
    ],
    plugin: 'vite-plugin-zephyr',
    importName: 'withZephyr',
    patterns: [
      {
        type: 'define-config-function',
        matcher: /defineConfig\s*\(\s*\(\s*\)\s*=>\s*\(\s*\{/,
        transform: 'addToVitePluginsInFunction',
      },
      {
        type: 'define-config',
        matcher: /defineConfig\s*\(\s*\{/,
        transform: 'addToVitePlugins',
      },
      {
        type: 'export-default',
        matcher: /export\s+default\s+\{/,
        transform: 'addToVitePlugins',
      },
    ],
  },

  // Rollup configurations
  rollup: {
    files: ['rollup.config.js', 'rollup.config.ts', 'rollup.config.mjs'],
    plugin: 'rollup-plugin-zephyr',
    importName: 'withZephyr',
    patterns: [
      {
        type: 'export-array',
        matcher: /export\s+default\s+\[/,
        transform: 'addToRollupArrayConfig',
      },
      {
        type: 'module-exports-function',
        matcher: /module\.exports\s*=\s*\(\s*config\s*\)\s*=>/,
        transform: 'addToRollupFunction',
      },
      {
        type: 'plugins-array',
        matcher: /plugins\s*:\s*\[/,
        transform: 'addToPluginsArray',
      },
    ],
  },

  // Rolldown configurations
  rolldown: {
    files: ['rolldown.config.js', 'rolldown.config.ts', 'rolldown.config.mjs'],
    plugin: 'zephyr-rolldown-plugin',
    importName: 'withZephyr',
    patterns: [
      {
        type: 'define-config',
        matcher: /defineConfig\s*\(\s*\{/,
        transform: 'addToRolldownPlugins',
      },
      {
        type: 'plugins-array',
        matcher: /plugins\s*:\s*\[/,
        transform: 'addToPluginsArray',
      },
    ],
  },

  // Modern.js configurations
  modernjs: {
    files: ['modern.config.js', 'modern.config.ts', 'modern.config.mjs'],
    plugin: 'zephyr-modernjs-plugin',
    importName: 'withZephyr',
    patterns: [
      {
        type: 'define-config',
        matcher: /defineConfig\s*\(\s*\{/,
        transform: 'addToModernJSPlugins',
      },
      {
        type: 'plugins-array',
        matcher: /plugins\s*:\s*\[/,
        transform: 'addToPluginsArray',
      },
    ],
  },

  // RSPress configurations
  rspress: {
    files: ['rspress.config.js', 'rspress.config.ts', 'rspress.config.mjs'],
    plugin: 'zephyr-rspress-plugin',
    importName: 'withZephyr',
    patterns: [
      {
        type: 'define-config',
        matcher: /defineConfig\s*\(\s*\{/,
        transform: 'addToRSPressPlugins',
      },
      {
        type: 'plugins-array',
        matcher: /plugins\s*:\s*\[/,
        transform: 'addToPluginsArray',
      },
    ],
  },

  // Parcel configurations (uses reporter pattern)
  parcel: {
    files: ['.parcelrc', '.parcelrc.json'],
    plugin: 'parcel-reporter-zephyr',
    importName: null, // Parcel uses JSON config
    patterns: [
      {
        type: 'parcel-reporters',
        matcher: /"reporters"\s*:\s*\[/,
        transform: 'addToParcelReporters',
      },
    ],
  },

  // Re.Pack configurations (React Native with Rspack)
  repack: {
    files: ['rspack.config.js', 'rspack.config.ts', 'rspack.config.mjs'],
    plugin: 'zephyr-repack-plugin',
    importName: 'withZephyr',
    patterns: [
      {
        type: 'export-conditional-withzephyr',
        matcher: /export\s+default\s+.*\?\s*withZephyr\s*\(\s*\)\s*\(/,
        transform: 'skipAlreadyWrapped',
      },
      {
        type: 'export-function-variable',
        matcher: /export\s+default\s+(\w+)\s*;?\s*$/,
        transform: 'wrapExportedFunction',
      },
      {
        type: 'const-function-export',
        matcher: /const\s+\w+\s*=\s*\w+\s*=>/,
        transform: 'wrapExportedFunction',
      },
    ],
  },

  // RSBuild configurations
  rsbuild: {
    files: ['rsbuild.config.js', 'rsbuild.config.ts', 'rsbuild.config.mjs'],
    plugin: 'zephyr-rspack-plugin',
    importName: 'withZephyr',
    patterns: [
      {
        type: 'zephyr-rsbuild-plugin-exists',
        matcher: /zephyrRSbuildPlugin/,
        transform: 'skipAlreadyWrapped',
      },
      {
        type: 'define-config',
        matcher: /defineConfig\s*\(\s*\{/,
        transform: 'addZephyrRSbuildPlugin',
      },
      {
        type: 'plugins-array',
        matcher: /plugins\s*:\s*\[/,
        transform: 'addZephyrRSbuildPlugin',
      },
    ],
  },
};
