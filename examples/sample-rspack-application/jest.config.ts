/* eslint-disable */
export default {
  displayName: 'sample-rspack-application',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/sample-rspack-application',
  transformIgnorePatterns: ['node_modules/(?!(@babel/runtime)/)'],
};
