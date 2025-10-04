const { composePlugins, withNx, withReact } = require('@nx/rspack');
const { withZephyr } = require('zephyr-rspack-plugin');

module.exports = composePlugins(
  withNx(),
  withReact(),
  withZephyr({
    hooks: {
      onDeployComplete: (info) => {
        console.log('🚀 Deployment Complete!');
        console.log(`   URL: ${info.url}`);
        console.log(`   Module: ${info.moduleName}`);
        console.log(`   Build ID: ${info.buildId}`);
        console.log(`   Dependencies: ${info.federatedDependencies.length}`);
        console.log(`   Duration: ${info.buildDuration}ms`);
        console.log(`   Git: ${info.git.branch}@${info.git.commit}`);
        console.log(`   CI: ${info.isCI ? 'Yes' : 'No'}`);
      }
    }
  }),
  (config) => {
    return config;
  }
);
