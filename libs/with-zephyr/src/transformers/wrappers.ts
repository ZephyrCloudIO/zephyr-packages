import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { BabelNode } from '../types.js';

/**
 * Wrap module.exports with withZephyr
 *
 * Transforms: module.exports = { ... } To: module.exports = withZephyr()({ ... })
 */
export function wrapModuleExports(ast: BabelNode): void {
  traverse(ast, {
    AssignmentExpression(path) {
      if (
        t.isMemberExpression(path.node.left) &&
        t.isIdentifier(path.node.left.object, { name: 'module' }) &&
        t.isIdentifier(path.node.left.property, { name: 'exports' })
      ) {
        // Wrap the exported value with withZephyr call
        path.node.right = t.callExpression(
          t.callExpression(t.identifier('withZephyr'), []),
          [path.node.right]
        );
      }
    },
  });
}

/**
 * Wrap export default with withZephyr
 *
 * Transforms: export default { ... } To: export default withZephyr()({ ... })
 */
export function wrapExportDefault(ast: BabelNode): void {
  traverse(ast, {
    ExportDefaultDeclaration(path) {
      if (t.isObjectExpression(path.node.declaration)) {
        // Wrap with withZephyr()({...})
        path.node.declaration = t.callExpression(
          t.callExpression(t.identifier('withZephyr'), []),
          [path.node.declaration]
        );
      }
    },
  });
}

/**
 * Wrap exported function for Re.Pack configuration
 *
 * Transforms: const config = env => { ... }; export default config; To: const config =
 * env => { ... }; export default withZephyr()(config);
 *
 * Skips conditional exports that already have withZephyr: export default USE_ZEPHYR ?
 * withZephyr()(config) : config;
 */
export function wrapExportedFunction(ast: BabelNode): void {
  traverse(ast, {
    ExportDefaultDeclaration(path) {
      const declaration = path.node.declaration;

      // Pattern: export default config
      if (t.isIdentifier(declaration)) {
        const configName = declaration.name;

        // Look for the config variable/function definition
        const binding = path.scope.getBinding(configName);
        if (binding && binding.path.isVariableDeclarator()) {
          const init = binding.path.node.init;

          // Check if it's a function (arrow or regular)
          if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
            // Replace: export default config
            // With: export default withZephyr()(config)
            const newExpression = t.callExpression(
              t.callExpression(t.identifier('withZephyr'), []),
              [declaration]
            );
            path.node.declaration = newExpression;
          }
        }
      }

      // Pattern: export default USE_ZEPHYR ? withZephyr()(config) : config
      // This should be skipped if already has conditional withZephyr
      else if (t.isConditionalExpression(declaration)) {
        // Skip - already has conditional withZephyr pattern
        return;
      }
    },
  });
}
