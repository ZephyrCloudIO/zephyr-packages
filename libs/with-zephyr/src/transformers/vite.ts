import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import type { BabelNode } from '../types.js';
import { addToPluginsArray } from './plugins-array.js';

const traverse = (traverseModule as any).default || traverseModule;

/**
 * Transform Vite config to add withZephyr This is a simple wrapper around
 * addToPluginsArray
 */
export function addToVitePlugins(ast: BabelNode): void {
  addToPluginsArray(ast);
}

/**
 * Transform Vite config with function wrapper to add withZephyr
 *
 * Handles configs like: export default defineConfig(() => ({ plugins: [react()] }))
 */
export function addToVitePluginsInFunction(ast: BabelNode): void {
  traverse(ast, {
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.callee, { name: 'defineConfig' }) &&
        path.node.arguments.length === 1 &&
        t.isArrowFunctionExpression(path.node.arguments[0])
      ) {
        const arrowFunc = path.node.arguments[0];

        // Handle both parenthesized and direct object expression
        let objExpr: t.ObjectExpression | null = null;
        if (
          t.isParenthesizedExpression(arrowFunc.body) &&
          t.isObjectExpression(arrowFunc.body.expression)
        ) {
          objExpr = arrowFunc.body.expression;
        } else if (t.isObjectExpression(arrowFunc.body)) {
          objExpr = arrowFunc.body;
        }

        if (objExpr) {
          // Find plugins property in the object
          for (const prop of objExpr.properties) {
            if (
              t.isObjectProperty(prop) &&
              t.isIdentifier(prop.key, { name: 'plugins' }) &&
              t.isArrayExpression(prop.value)
            ) {
              prop.value.elements.push(t.callExpression(t.identifier('withZephyr'), []));
              break;
            }
          }
        }
      }
    },
  });
}
