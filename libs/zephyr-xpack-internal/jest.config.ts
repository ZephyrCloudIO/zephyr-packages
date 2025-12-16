export default {
  displayName: 'zephyr-xpack-internal',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['<rootDir>/src'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/zephyr-xpack-internal',
};
