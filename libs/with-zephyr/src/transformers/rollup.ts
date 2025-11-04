import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import type { BabelNode } from '../types.js';

const traverse = (traverseModule as any).default || traverseModule;

/**
 * Transform Rollup function config
 *
 * Handles configs like: module.exports = (config) => { // ... modifications return
 * config; }
 *
 * Inserts <paramName>.plugins.push(withZephyr()) before the return statement Works with
 * any parameter name (config, cfg, options, etc.)
 */
export function addToRollupFunction(ast: BabelNode): void {
  traverse(ast, {
    ArrowFunctionExpression(path) {
      if (path.node.params.length === 1 && t.isIdentifier(path.node.params[0])) {
        // Get the actual parameter name (config, cfg, options, etc.)
        const paramName = (path.node.params[0] as t.Identifier).name;

        // Add <paramName>.plugins.push(withZephyr());
        const pushStatement = t.expressionStatement(
          t.callExpression(
            t.memberExpression(
              t.memberExpression(t.identifier(paramName), t.identifier('plugins')),
              t.identifier('push')
            ),
            [t.callExpression(t.identifier('withZephyr'), [])]
          )
        );

        if (t.isBlockStatement(path.node.body)) {
          // Find return statement and insert before it
          const returnIndex = path.node.body.body.findIndex((stmt) =>
            t.isReturnStatement(stmt)
          );
          if (returnIndex >= 0) {
            path.node.body.body.splice(returnIndex, 0, pushStatement);
          } else {
            path.node.body.body.push(pushStatement);
          }
        }
      }
    },
  });
}

/**
 * Handle Rollup array config
 *
 * Handles configs like: export default [{ input: 'src/index.ts', plugins: [resolve(),
 * babel()] }]
 *
 * Adds withZephyr() to the plugins array in the first config object only
 */
export function addToRollupArrayConfig(ast: BabelNode): void {
  traverse(ast, {
    ExportDefaultDeclaration(path) {
      if (t.isArrayExpression(path.node.declaration)) {
        // Find first object in array and add to its plugins
        for (const element of path.node.declaration.elements) {
          if (t.isObjectExpression(element)) {
            for (const prop of element.properties) {
              if (
                t.isObjectProperty(prop) &&
                t.isIdentifier(prop.key, { name: 'plugins' }) &&
                t.isArrayExpression(prop.value)
              ) {
                prop.value.elements.push(
                  t.callExpression(t.identifier('withZephyr'), [])
                );
                return; // Only modify first config object
              }
            }
          }
        }
      }
    },
  });
}
