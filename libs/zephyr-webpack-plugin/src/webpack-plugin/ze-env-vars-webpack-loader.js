const { ze_log } = require('zephyr-agent');

module.exports = function loader(source) {
  const { resourcePath } = this;

  if (!/\.(js|jsx|ts|tsx)$/.test(resourcePath)) {
    return source;
  }

  const regex = /process\.env\.([a-zA-Z_][a-zA-Z0-9_]*)/g;

  const variablesSet = new Set();
  let transformedSource = source;

  transformedSource = transformedSource.replace(regex, (_, key) => {
    const value = process.env[key];

    if (value !== undefined) {
      variablesSet.add(key);
      return JSON.stringify(value);
    }

    return `process.env.${key}`;
  });

  if (variablesSet.size > 0) {
    ze_log(
      `WebpackLoader: Replaced ${variablesSet.size} Zephyr env vars in ${resourcePath}: ${Array.from(variablesSet).join(', ')}`
    );

    if (this.zeEnvVars) {
      variablesSet.forEach((v) => this.zeEnvVars.add(v));
    }
  }

  return transformedSource;
};
