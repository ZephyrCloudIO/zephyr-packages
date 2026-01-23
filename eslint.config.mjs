import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import js from '@eslint/js';
import nxEslintPlugin from '@nx/eslint-plugin';

const __dirname = dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    ignores: ['**/dist', 'libs/zephyr-metro-plugin/src/lib/global.d.ts'],
  },
  { plugins: { '@nx': nxEslintPlugin } },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: false,
          allow: [],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  ...compat
    .config({
      extends: ['plugin:@nx/typescript'],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
      rules: {
        ...config.rules,
        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/ban-ts-comment': ['warn', {}],
      },
    })),
  ...compat
    .config({
      env: {
        jest: true,
      },
    })
    .map((config) => ({
      ...config,
      files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx'],
      rules: {
        ...config.rules,
      },
    })),
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': 'off',
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  {
    files: ['**/*.js', '**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "ThrowStatement > NewExpression[callee.name='Error']",
          message: 'Use ZephyrError instead of Error',
        },
      ],
    },
    ignores: ['**/*.test.js', '**/*.spec.js', '**/*.test.ts', '**/*.spec.ts'],
  },
  {
    files: ['libs/ze-types/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    ignores: ['**/webpack.config.ts', '**/jest.config.ts', '**/*.spec.tsx'],
  },
  {
    ignores: ['dist', 'tmp', 'legacy'],
  },
];
