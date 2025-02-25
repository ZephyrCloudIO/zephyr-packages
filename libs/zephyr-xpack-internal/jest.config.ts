/* eslint-disable */
export default {
  displayName: 'zephyr-xpack-internal',
  preset: '../../jest.preset.cjs',
  testEnvironment: 'node',
  // Allow tests in src directory
  // testPathIgnorePatterns: ['<rootDir>/src'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/zephyr-xpack-internal',
};
