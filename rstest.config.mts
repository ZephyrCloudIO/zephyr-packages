import { defineConfig, defineProject, type ProjectConfig } from '@rstest/core';
import path from 'node:path';

const workspaceRoot = import.meta.dirname;

function project(
  name: string,
  root: string,
  options: Partial<ProjectConfig> = {}
): ProjectConfig {
  const projectRoot = path.resolve(workspaceRoot, root);

  return defineProject({
    name,
    root: projectRoot,
    globals: false,
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**', 'lib/**'],
    source: {
      tsconfigPath: path.join(projectRoot, 'tsconfig.spec.json'),
    },
    tools: {
      swc: {
        jsc: {
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
        },
      },
      rspack: {
        externals: {
          debug: 'commonjs debug',
          'node-persist': 'commonjs node-persist',
        },
        resolve: {
          alias: {
            'react-native': path.resolve(
              workspaceRoot,
              'scripts/rstest/react-native.ts'
            ),
          },
        },
      },
    },
    testEnvironment: 'node',
    testTimeout: 30_000,
    ...options,
  });
}

export default defineConfig({
  coverage: {
    provider: 'istanbul',
    reporters: ['json', 'lcov', 'text', 'clover'],
    reportsDirectory: path.resolve(workspaceRoot, 'coverage'),
    thresholds: {
      statements: 50,
      branches: 45,
      functions: 58,
      lines: 50,
    },
    include: ['src/**/*.ts', 'src/**/*.tsx'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.d.ts',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.test.tsx',
      '**/*.spec.tsx',
      // Rstest 0.10.6 cannot synthesize zero-hit coverage for files that opt out
      // with `istanbul ignore file`; exclude those files before collection.
      path.resolve(workspaceRoot, 'libs/zephyr-edge-contract/src/index.ts'),
      path.resolve(
        workspaceRoot,
        'libs/zephyr-edge-contract/src/lib/zephyr-build-stats.ts'
      ),
      path.resolve(
        workspaceRoot,
        'libs/zephyr-edge-contract/src/lib/zephyr-edge-contract.ts'
      ),
      path.resolve(
        workspaceRoot,
        'libs/zephyr-edge-contract/src/lib/snapshot.ts'
      ),
      path.resolve(
        workspaceRoot,
        'libs/zephyr-edge-contract/src/lib/zephyr-global.ts'
      ),
      path.resolve(
        workspaceRoot,
        'libs/zephyr-edge-contract/src/lib/api-contract-negotiation/get-api-contract.ts'
      ),
      path.resolve(workspaceRoot, 'libs/zephyr-metro-plugin/src/index.ts'),
    ],
    allowExternal: true,
  },
  projects: [
    project('parcel-reporter-zephyr', 'libs/parcel-reporter-zephyr'),
    project('rollup-plugin-zephyr', 'libs/rollup-plugin-zephyr'),
    project(
      'vite-plugin-tanstack-start-zephyr',
      'libs/vite-plugin-tanstack-start-zephyr'
    ),
    project('vite-plugin-vinext-zephyr', 'libs/vite-plugin-vinext-zephyr'),
    project('vite-plugin-zephyr', 'libs/vite-plugin-zephyr'),
    project('with-zephyr', 'libs/with-zephyr'),
    project('zephyr-agent', 'libs/zephyr-agent'),
    project('zephyr-astro-integration', 'libs/zephyr-astro-integration'),
    project('zephyr-cli', 'libs/zephyr-cli'),
    project('zephyr-edge-contract', 'libs/zephyr-edge-contract'),
    project('zephyr-metro-plugin', 'libs/zephyr-metro-plugin'),
    project('zephyr-native-cache', 'libs/zephyr-native-cache'),
    project('zephyr-nuxt-module', 'libs/zephyr-nuxt-module'),
    project('zephyr-rolldown-plugin', 'libs/zephyr-rolldown-plugin'),
    project('zephyr-modernjs-plugin', 'libs/zephyr-modernjs-plugin'),
    project('zephyr-rsbuild-plugin', 'libs/zephyr-rsbuild-plugin'),
    project('zephyr-rspack-plugin', 'libs/zephyr-rspack-plugin'),
    project('zephyr-rspress-plugin', 'libs/zephyr-rspress-plugin'),
    project('zephyr-webpack-plugin', 'libs/zephyr-webpack-plugin'),
    project('zephyr-xpack-internal', 'libs/zephyr-xpack-internal'),
    project('example-rollup-sample-lib', 'examples/rollup-sample-lib', {
      testEnvironment: 'jsdom',
    }),
    project('example-rspack-host', 'examples/rspack-nx-mf/apps/host', {
      testEnvironment: 'jsdom',
    }),
    project('example-rspack-remote', 'examples/rspack-nx-mf/apps/remote', {
      testEnvironment: 'jsdom',
    }),
    project(
      'example-sample-rspack-application',
      'examples/sample-rspack-application',
      {
        testEnvironment: 'jsdom',
      }
    ),
    project(
      'example-sample-webpack-application',
      'examples/sample-webpack-application',
      {
        testEnvironment: 'jsdom',
      }
    ),
  ],
});
