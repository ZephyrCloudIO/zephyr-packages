const { withZephyr } = require('rollup-plugin-zephyr');

module.exports = {
  input: 'dist/out-tsc/index.js',
  output: {
    file: 'dist/index.esm.js',
    format: 'esm',
    sourcemap: true,
  },
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-router-dom'],
  plugins: [withZephyr()],
};
