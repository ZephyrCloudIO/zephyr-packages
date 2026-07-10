import { defineConfig, defineInlineProject } from '@rstest/core';
import path from 'node:path';
import { createProjectConfig } from './scripts/rstest/project-config.mts';

const workspaceRoot = import.meta.dirname;

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
      path.resolve(workspaceRoot, 'libs/zephyr-edge-contract/src/lib/zephyr-build-stats.ts'),
      path.resolve(workspaceRoot, 'libs/zephyr-edge-contract/src/lib/zephyr-edge-contract.ts'),
      path.resolve(workspaceRoot, 'libs/zephyr-edge-contract/src/lib/snapshot.ts'),
      path.resolve(workspaceRoot, 'libs/zephyr-edge-contract/src/lib/zephyr-global.ts'),
      path.resolve(
        workspaceRoot,
        'libs/zephyr-edge-contract/src/lib/api-contract-negotiation/get-api-contract.ts'
      ),
      path.resolve(workspaceRoot, 'libs/zephyr-metro-plugin/src/index.ts'),
    ],
    allowExternal: true,
  },
  projects: [
    'libs/*/rstest.config.mts',
    'examples/*/rstest.config.mts',
    'examples/*/apps/*/rstest.config.mts',
    defineInlineProject(
      createProjectConfig({
        name: 'release-tooling',
        root: workspaceRoot,
        include: ['scripts/*.{test,spec}.?(c|m)[jt]s?(x)'],
      })
    ),
  ],
});
