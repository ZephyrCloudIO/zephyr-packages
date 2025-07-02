/** Simple test adapter to verify Next.js adapter API works */

const testAdapter = {
  name: 'test-adapter',

  modifyConfig: (config) => {
    console.log('🔧 TEST ADAPTER: modifyConfig called!');
    console.log('🔧 CONFIG:', JSON.stringify(config, null, 2));

    // Set output to standalone for better testing
    config.output = 'standalone';

    return config;
  },

  onBuildComplete: (ctx) => {
    console.log('🎯 TEST ADAPTER: onBuildComplete called!');
    console.log('🎯 CONTEXT ROUTES:', Object.keys(ctx.routes));
    console.log('🎯 OUTPUTS COUNT:', ctx.outputs.length);
    console.log('🎯 FIRST OUTPUT:', ctx.outputs[0]);
  },
};

module.exports = testAdapter;
