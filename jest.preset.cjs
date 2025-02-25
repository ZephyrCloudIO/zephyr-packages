const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  collectCoverageFrom: [
    '**/*.{js,ts,tsx}', // Adjust to include the relevant file extensions you want coverage for
    '!**/node_modules/**',
    '!**/dist/**', // Ignore the dist folder
    '!**/coverage/**',
  ],
  transformIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '^.+\\.js$', // Ignore transforming .js files
  ],
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
};
