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
        console.log(`   Module: ${info.snapshot.uid.app_name}`);
        console.log(`   Build ID: ${info.snapshot.uid.build}`);
        console.log(`   Dependencies: ${info.federatedDependencies.length}`);
        console.log(`   Git: ${info.snapshot.git.branch}@${info.snapshot.git.commit}`);
        console.log(`   CI: ${info.buildStats.context.isCI ? 'Yes' : 'No'}`);
      },
    },
  }),
  (config) => {
    return config;
  }
);
