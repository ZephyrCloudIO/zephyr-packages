const { findAndReplaceVariables } = require('zephyr-agent');
const { ze_log } = require('zephyr-agent');

/**
 * Webpack loader for processing ZE_ environment variables in source files. This runs
 * during the transform phase, before bundling.
 */
module.exports = function loader(source) {
  // Skip non-JS/TS files
  const { resourcePath } = this;
  if (!/\.(js|jsx|ts|tsx)$/.test(resourcePath)) {
    return source;
  }

  // Detect and transform environment variables
  const variablesSet = new Set();
  const transformedSource = findAndReplaceVariables(source, variablesSet, [
    'importMetaEnv',
    'processEnv',
  ]);

  // Add detected variables to the global set
  if (variablesSet.size > 0) {
    ze_log(
      `WebpackLoader: Detected ${variablesSet.size} Zephyr env vars in ${resourcePath}: ${Array.from(variablesSet).join(', ')}`
    );

    // Add to the shared global set provided by the plugin
    if (this.zeEnvVars) {
      variablesSet.forEach((v) => this.zeEnvVars.add(v));
    }
  }

  return transformedSource;
};
