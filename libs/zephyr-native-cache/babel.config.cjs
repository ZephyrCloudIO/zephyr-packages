'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SOURCE_EXTENSIONS = [
  ['js', 'js'],
  ['jsx', 'js'],
  ['ts', 'js'],
  ['tsx', 'js'],
  ['mjs', 'mjs'],
  ['mts', 'mjs'],
  ['cjs', 'cjs'],
  ['cts', 'cjs'],
];

function emittedRelativeSpecifier(filename, specifier) {
  if (!specifier.startsWith('.')) return specifier;

  for (const [sourceExtension, outputExtension] of SOURCE_EXTENSIONS) {
    if (specifier.endsWith(`.${sourceExtension}`)) {
      return `${specifier.slice(0, -sourceExtension.length)}${outputExtension}`;
    }
  }

  const target = path.resolve(path.dirname(filename), specifier);
  for (const [sourceExtension, outputExtension] of SOURCE_EXTENSIONS) {
    if (fs.existsSync(`${target}.${sourceExtension}`)) {
      return `${specifier}.${outputExtension}`;
    }
  }
  for (const [sourceExtension, outputExtension] of SOURCE_EXTENSIONS) {
    if (fs.existsSync(path.join(target, `index.${sourceExtension}`))) {
      return `${specifier.replace(/\/$/, '')}/index.${outputExtension}`;
    }
  }

  // Keep unresolved relative imports extensionless so React Native's platform-specific
  // resolution (for example, `module.ios.ts`) continues to work.
  return specifier;
}

function rewriteRelativeSpecifiers() {
  const rewrite = (node, state) => {
    if (
      node.source?.value &&
      node.importKind !== 'type' &&
      node.exportKind !== 'type'
    ) {
      node.source.value = emittedRelativeSpecifier(
        state.filename,
        node.source.value
      );
    }
  };

  return {
    name: 'zephyr-native-cache-relative-specifiers',
    visitor: {
      ImportDeclaration({ node }, state) {
        rewrite(node, state);
      },
      ExportNamedDeclaration({ node }, state) {
        rewrite(node, state);
      },
      ExportAllDeclaration({ node }, state) {
        rewrite(node, state);
      },
    },
  };
}

module.exports = (api) => {
  const supportsStaticESM =
    api.caller((caller) => caller?.supportsStaticESM) ?? false;

  return {
    presets: [
      [
        require.resolve('@babel/preset-env'),
        {
          modules: supportsStaticESM ? false : 'commonjs',
          targets: {
            browsers: [
              '> 1%',
              'chrome 109',
              'edge 124',
              'firefox 127',
              'safari 17.4',
              'not dead',
              'not ie <= 11',
              'not op_mini all',
              'not android <= 4.4',
              'not samsung <= 4',
            ],
            node: '18',
          },
          useBuiltIns: false,
        },
      ],
      require.resolve('@babel/preset-typescript'),
    ],
    plugins: [rewriteRelativeSpecifiers],
  };
};
