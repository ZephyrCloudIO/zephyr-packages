const { withZephyr } = require('rollup-plugin-zephyr');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');

module.exports = {
  input: './src/index.ts',
  output: {
    file: './dist/index.js',
    format: 'esm',
    sourcemap: true,
  },
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  plugins: [
    nodeResolve({
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
    }),
    withZephyr(),
  ],
};
