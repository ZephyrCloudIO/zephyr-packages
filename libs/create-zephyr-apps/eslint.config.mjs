import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2020,
      },
    },
  },
  {
    ignores: ['test', 'test*'],
  },
];
