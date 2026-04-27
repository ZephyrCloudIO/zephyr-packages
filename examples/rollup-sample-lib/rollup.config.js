const { withZephyr } = require('rollup-plugin-zephyr');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');

function cssModules() {
  return {
    name: 'css-modules',
    transform(code, id) {
      if (!id.endsWith('.module.css')) {
        return null;
      }
      const classes = [...code.matchAll(/\.([_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map(
        ([, className]) => className
      );
      const tokens = Object.fromEntries(
        classes.map((className) => [className, className])
      );
      return {
        code: `export default ${JSON.stringify(tokens)};`,
        map: { mappings: '' },
      };
    },
  };
}

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
    cssModules(),
    withZephyr(),
  ],
};
