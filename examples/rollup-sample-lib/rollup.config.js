const {withZephyr} = require('rollup-plugin-zephyr')

module.exports = (config) => {
  config.plugins.push(withZephyr());
  return config;
}
