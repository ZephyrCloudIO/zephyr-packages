/* eslint-disable */
export default {
  displayName: 'zephyr-repack-plugin',
  preset: '../../jest.preset.cjs',
  testEnvironment: 'node',
  passWithNoTests: true,
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/zephyr-repack-plugin',
};
