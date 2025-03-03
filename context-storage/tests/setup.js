// Setup performance.now() for Node.js environment
if (typeof performance === 'undefined') {
  global.performance = require('perf_hooks').performance;
}