// Simple test adapter to see if Next.js adapter API is working
module.exports = {
  name: 'test-adapter',
  modifyConfig: (config) => {
    console.log('🔧 TEST ADAPTER: modifyConfig called!');
    return config;
  },
  onBuildComplete: (ctx) => {
    console.log('🎯 TEST ADAPTER: onBuildComplete called!');
    console.log('Routes:', Object.keys(ctx.routes));
    console.log('Outputs count:', ctx.outputs.length);
  },
};
