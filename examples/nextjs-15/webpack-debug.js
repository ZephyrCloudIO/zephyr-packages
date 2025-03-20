/**
 * A utility to debug the webpack/rspack configuration Add this to your next.config.js to
 * log the configuration
 */

function debugWebpackConfig(nextConfig = {}) {
  return {
    ...nextConfig,
    webpack: (config, options) => {
      // Call the original webpack function if it exists
      if (typeof nextConfig.webpack === 'function') {
        config = nextConfig.webpack(config, options);
      }

      // Log the webpack configuration
      console.log('=========== WEBPACK CONFIG ===========');
      console.log(JSON.stringify(config, null, 2));
      console.log('======================================');

      return config;
    },
  };
}

module.exports = { debugWebpackConfig };
