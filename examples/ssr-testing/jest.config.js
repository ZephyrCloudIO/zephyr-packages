module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/core/$1',
    '^@performance/(.*)$': '<rootDir>/performance/$1',
    '^@fixtures/(.*)$': '<rootDir>/fixtures/$1',
    '^@integration/(.*)$': '<rootDir>/integration/$1',
    '^@reporting/(.*)$': '<rootDir>/reporting/$1'
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'core/**/*.{ts,tsx}',
    'performance/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};