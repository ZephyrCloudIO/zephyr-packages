/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      isolatedModules: true, // This will skip type checking
      diagnostics: false
    }]
  },
  collectCoverage: true,
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    "*.ts",
    "!**/*.d.ts"
  ],
};