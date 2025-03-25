import type { CategoryConfig, CoreConfig } from '@code-pushup/models';
import coveragePlugin from '@code-pushup/coverage-plugin';
import eslintPlugin from '@code-pushup/eslint-plugin';
import jsPackagesPlugin from '@code-pushup/js-packages-plugin';
import { dirname, join } from 'path';
import { readCachedProjectGraph } from '@nx/devkit';
import nxPerformancePlugin from './tools/code-pushup/plugins/nx-performance/nx-performance.plugin';

export const jsPackagesCategories = (packageManager: string): CategoryConfig[] => [
  {
    slug: 'security',
    title: 'Security',
    description: 'Finds known **vulnerabilities** in 3rd-party packages.',
    refs: [
      {
        type: 'group',
        plugin: 'js-packages',
        slug: `${packageManager}-audit`,
        weight: 1,
      },
    ],
  },
  {
    slug: 'updates',
    title: 'Updates',
    description: 'Finds **outdated** 3rd-party packages.',
    refs: [
      {
        type: 'group',
        plugin: 'js-packages',
        slug: `${packageManager}-outdated`,
        weight: 1,
      },
    ],
  },
];

export const eslintCategories: CategoryConfig[] = [
  {
    slug: 'bug-prevention',
    title: 'Bug prevention',
    description: 'Lint rules that find **potential bugs** in your code.',
    refs: [{ type: 'group', plugin: 'eslint', slug: 'problems', weight: 1 }],
  },
  {
    slug: 'code-style',
    title: 'Code style',
    description:
      'Lint rules that promote **good practices** and consistency in your code.',
    refs: [{ type: 'group', plugin: 'eslint', slug: 'suggestions', weight: 1 }],
  },
];

export const jsPackagesCoreConfig = async (projectName?: string): Promise<CoreConfig> => {
  const root = projectName
    ? dirname(
        Object.entries(readCachedProjectGraph().nodes)
          .find(([key]) => key === projectName)
          .at(1).data.sourceRoot
      )
    : '.';
  return {
    plugins: [
      await jsPackagesPlugin({
        packageManager: 'pnpm',
        packageJsonPaths: [join(root, 'package.json')],
      }),
    ],
    categories: jsPackagesCategories('pnpm'),
  };
};

export const nxPerformanceCoreConfig = async (): Promise<CoreConfig> => {
  return {
    plugins: [
      await nxPerformancePlugin({
        taskGraphTasks: ['build', 'test', 'lint'],
      }),
    ],
  };
};

export const eslintCoreConfigNx = async (): Promise<CoreConfig> => {
  return {
    plugins: [
      await eslintPlugin({
        patterns: ['src/*.ts'],
        eslintrc: '.eslintrc.json',
      }),
    ],
    categories: eslintCategories,
  };
};

export const coverageCoreConfig = async ({
  projectName = process.env['NX_TASK_TARGET_PROJECT'],
  targetNames = ['test'],
}: {
  projectName?: string;
  targetNames?: string[];
}): Promise<CoreConfig> => {
  const name = projectName ?? process.env['NX_TASK_TARGET_PROJECT'];
  if (!name) {
    throw new Error('Project name is required');
  }
  const sourceRoot = dirname(
    Object.entries(readCachedProjectGraph().nodes)
      .find(([key]) => key === projectName)
      .at(1).data.sourceRoot
  );

  return {
    plugins: [
      await coveragePlugin({
        coverageToolCommand: {
          command: 'pnpx',
          args: [
            'nx',
            'run-many',
            `--projects ${name}`,
            '-t',
            ...targetNames,
            '--coverage',
            '--skipNxCache',
          ],
        },
        reports: [join(`coverage/${sourceRoot}`, `lcov.info`)],
      }),
    ],
    categories: [
      {
        slug: 'code-coverage',
        title: 'Code coverage',
        description: 'Measures how much of your code is **covered by tests**.',
        refs: [
          {
            type: 'group',
            plugin: 'coverage',
            slug: 'coverage',
            weight: 1,
          },
        ],
      },
    ],
  };
};
