import type { ProjectConfig } from '@rstest/core';
import path from 'node:path';

const workspaceRoot = import.meta.dirname;

export const testDiscoveryPattern = '**/*.{test,spec}.?(c|m)[jt]s?(x)';

export type ZephyrProjectConfig = Omit<ProjectConfig, 'name' | 'root'> & {
  name: string;
  root: string;
};

export function createProjectConfig({
  name,
  root,
  ...overrides
}: ZephyrProjectConfig): ZephyrProjectConfig {
  return {
    name,
    root,
    globals: false,
    include: [testDiscoveryPattern],
    exclude: ['**/node_modules/**', '**/dist/**', 'lib/**'],
    source: {
      tsconfigPath: path.join(root, 'tsconfig.json'),
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
        experiments: {
          typeReexportsPresence: true,
        },
        externals: {
          debug: 'commonjs debug',
          'node-persist': 'commonjs node-persist',
        },
        resolve: {
          alias: {
            'react-native': path.resolve(
              workspaceRoot,
              'libs/zephyr-native-cache/__tests__/react-native.ts'
            ),
          },
        },
      },
    },
    testEnvironment: 'node',
    testTimeout: 30_000,
    ...overrides,
  };
}
