import baseConfig from '../../eslint.config.mjs';
import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import js from '@eslint/js';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
});

export default [
  ...baseConfig,
  ...compat.extends('plugin:@nx/react').map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),
];
