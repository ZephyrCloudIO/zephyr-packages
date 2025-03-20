/**
 * A NextJS plugin that wraps the Zephyr rspack plugin to make it compatible with NextJS's
 * plugin system.
 */
const { withZephyr } = require('zephyr-rspack-plugin');
let ZeRspackPlugin;
let ZephyrEngine;
let extractFederatedDependencyPairs;
let makeCopyOfModuleFederationOptions;
let mutWebpackFederatedRemotesConfig;

// Attempt to load required modules
try {
  ZeRspackPlugin =
    require('zephyr-rspack-plugin/dist/rspack-plugin/ze-rspack-plugin').ZeRspackPlugin;
  ZephyrEngine = require('zephyr-agent').ZephyrEngine;
  const zephyrXpack = require('zephyr-xpack-internal');
  extractFederatedDependencyPairs = zephyrXpack.extractFederatedDependencyPairs;
  makeCopyOfModuleFederationOptions = zephyrXpack.makeCopyOfModuleFederationOptions;
  mutWebpackFederatedRemotesConfig = zephyrXpack.mutWebpackFederatedRemotesConfig;
  console.log('Successfully loaded Zephyr dependencies');
} catch (error) {
  console.error('Failed to load Zephyr dependencies:', error);
}

/**
 * Direct integration with @next/plugin-rspack This hooks into the rspack plugin directly
 * using the rspackOptions property
 */
function withZephyrRspack(zephyrOptions = {}) {
  console.log('Initializing withZephyrRspack with options:', zephyrOptions);

  return (nextConfig = {}) => {
    console.log('withZephyrRspack applied to nextConfig');

    // Store the original rspack options function if it exists
    const originalRspackOptions = nextConfig.rspackOptions;
    console.log('Original rspackOptions exists:', !!originalRspackOptions);

    return {
      ...nextConfig,
      // Override the rspack options
      rspackOptions: (rspackConfig) => {
        console.log(
          'rspackOptions function called with config context:',
          rspackConfig?.context
        );

        // Apply the original options if they exist
        if (typeof originalRspackOptions === 'function') {
          console.log('Applying original rspackOptions function');
          rspackConfig = originalRspackOptions(rspackConfig);
        }

        // Function to apply Zephyr changes
        const applyZephyr = async (config) => {
          console.log('Starting to apply Zephyr to rspack config');

          if (!ZephyrEngine || !ZeRspackPlugin) {
            console.error('Required Zephyr modules not available');
            return config;
          }

          try {
            // Create instance of ZephyrEngine to track the application
            console.log('Creating ZephyrEngine instance');
            const zephyr_engine = await ZephyrEngine.create({
              builder: 'rspack',
              context: config.context,
            });
            console.log('ZephyrEngine created successfully');

            // Extract dependencies and update the config
            const dependencyPairs = extractFederatedDependencyPairs(config);
            console.log('Extracted dependency pairs:', dependencyPairs);

            const resolved_dependency_pairs =
              await zephyr_engine.resolve_remote_dependencies(dependencyPairs);
            console.log('Resolved dependency pairs:', resolved_dependency_pairs);

            mutWebpackFederatedRemotesConfig(
              zephyr_engine,
              config,
              resolved_dependency_pairs
            );
            console.log('Updated webpack federated remotes config');

            // Inject the ZephyrRspackPlugin
            config.plugins = config.plugins || [];
            console.log('Injecting ZeRspackPlugin');
            config.plugins.push(
              new ZeRspackPlugin({
                zephyr_engine,
                mfConfig: makeCopyOfModuleFederationOptions(config),
                wait_for_index_html: zephyrOptions?.wait_for_index_html,
              })
            );

            console.log('Successfully applied Zephyr to rspack configuration');
            return config;
          } catch (error) {
            console.error('Error applying Zephyr to rspack:', error);
            console.error(error.stack);
            return config;
          }
        };

        // We need to handle async operations in a way that doesn't return a Promise
        // from the rspackOptions function, as NextJS doesn't support that
        applyZephyr(rspackConfig).catch((error) => {
          console.error('Async error applying Zephyr:', error);
        });

        // Return the config directly, don't wait for the async operations
        return rspackConfig;
      },

      // Add a webpack function too for completeness
      webpack: (config, options) => {
        console.log('webpack function called - in withZephyrRspack');

        // First apply any custom webpack config from nextConfig
        if (typeof nextConfig.webpack === 'function') {
          config = nextConfig.webpack(config, options);
        }

        return config;
      },
    };
  };
}

// Keep the old implementation as a fallback
function withZephyrNextJS(zephyrOptions = {}) {
  console.log('withZephyrNextJS called - this is the fallback method');

  return (nextConfig = {}) => {
    return {
      ...nextConfig,
      webpack: (config, options) => {
        console.log('webpack function called - in withZephyrNextJS');

        // First apply any custom webpack config from nextConfig
        if (typeof nextConfig.webpack === 'function') {
          config = nextConfig.webpack(config, options);
        }

        console.warn(
          'Using webpack fallback - this is not recommended. Use withZephyrRspack instead.'
        );
        return config;
      },
    };
  };
}

module.exports = {
  withZephyrNextJS,
  withZephyrRspack,
};
