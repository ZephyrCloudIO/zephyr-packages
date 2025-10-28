import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { BabelNode } from '../types.js';

/**
 * Transform Astro config to add withZephyr to integrations array
 *
 * Handles configs like: export default defineConfig({ integrations: [mdx(), sitemap()] })
 */
export function addToAstroIntegrations(ast: BabelNode): void {
  traverse(ast, {
    ObjectExpression(path) {
      // Look for integrations property in the config object
      for (const prop of path.node.properties) {
        if (
          t.isObjectProperty(prop) &&
          t.isIdentifier(prop.key, { name: 'integrations' }) &&
          t.isArrayExpression(prop.value)
        ) {
          // Add withZephyr() call to the integrations array
          prop.value.elements.push(t.callExpression(t.identifier('withZephyr'), []));
          path.stop();
          return;
        }
      }
    },
  });
}

/**
 * Transform Astro config with function wrapper to add withZephyr
 *
 * Handles configs like: export default defineConfig(() => ({ integrations: [mdx()] }))
 */
export function addToAstroIntegrationsInFunction(ast: BabelNode): void {
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
          // Find integrations property in the object
          for (const prop of objExpr.properties) {
            if (
              t.isObjectProperty(prop) &&
              t.isIdentifier(prop.key, { name: 'integrations' }) &&
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
