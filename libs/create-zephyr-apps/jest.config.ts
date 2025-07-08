/* eslint-disable */
export default {
  displayName: 'create-zephyr-apps',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/create-zephyr-apps',
  testMatch: ['<rootDir>/__tests__/**/*.spec.ts'],
};
