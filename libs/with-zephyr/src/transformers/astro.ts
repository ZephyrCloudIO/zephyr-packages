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

/**
 * Add withZephyr to integrations array in defineConfig, creating the array if it doesn't
 * exist
 *
 * This transformer:
 *
 * 1. Looks for defineConfig({ ... }) calls
 * 2. If integrations array exists, adds withZephyr() to it
 * 3. If no integrations array exists, creates one with withZephyr()
 * 4. Falls back to addToAstroIntegrations if no defineConfig found
 */
export function addToAstroIntegrationsOrCreate(ast: BabelNode): void {
  let integrationAdded = false;

  traverse(ast, {
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.callee, { name: 'defineConfig' }) &&
        path.node.arguments.length === 1 &&
        t.isObjectExpression(path.node.arguments[0])
      ) {
        const configObject = path.node.arguments[0];
        let integrationsProperty: t.ObjectProperty | null = null;

        // Look for existing integrations property
        for (const prop of configObject.properties) {
          if (
            t.isObjectProperty(prop) &&
            t.isIdentifier(prop.key, { name: 'integrations' }) &&
            t.isArrayExpression(prop.value)
          ) {
            integrationsProperty = prop;
            break;
          }
        }

        if (integrationsProperty && t.isArrayExpression(integrationsProperty.value)) {
          // Add to existing integrations array
          integrationsProperty.value.elements.push(
            t.callExpression(t.identifier('withZephyr'), [])
          );
          integrationAdded = true;
        } else if (!integrationsProperty) {
          // Create new integrations array with withZephyr
          const newIntegrationsProperty = t.objectProperty(
            t.identifier('integrations'),
            t.arrayExpression([t.callExpression(t.identifier('withZephyr'), [])])
          );
          configObject.properties.push(newIntegrationsProperty);
          integrationAdded = true;
        }
      }
    },
  });

  // If we didn't find a defineConfig call, fall back to looking for any integrations array
  if (!integrationAdded) {
    addToAstroIntegrations(ast);
  }
}

/**
 * Add withZephyr to integrations array in function-wrapped defineConfig, creating the
 * array if it doesn't exist
 *
 * This transformer:
 *
 * 1. Looks for defineConfig(() => ({ ... })) calls
 * 2. If integrations array exists, adds withZephyr() to it
 * 3. If no integrations array exists, creates one with withZephyr()
 * 4. Falls back to addToAstroIntegrationsInFunction if no suitable pattern found
 */
export function addToAstroIntegrationsInFunctionOrCreate(ast: BabelNode): void {
  let integrationAdded = false;

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
          let integrationsProperty: t.ObjectProperty | null = null;

          // Find integrations property in the object
          for (const prop of objExpr.properties) {
            if (
              t.isObjectProperty(prop) &&
              t.isIdentifier(prop.key, { name: 'integrations' }) &&
              t.isArrayExpression(prop.value)
            ) {
              integrationsProperty = prop;
              break;
            }
          }

          if (integrationsProperty && t.isArrayExpression(integrationsProperty.value)) {
            // Add to existing integrations array
            integrationsProperty.value.elements.push(
              t.callExpression(t.identifier('withZephyr'), [])
            );
            integrationAdded = true;
          } else if (!integrationsProperty) {
            // Create new integrations array with withZephyr
            const newIntegrationsProperty = t.objectProperty(
              t.identifier('integrations'),
              t.arrayExpression([t.callExpression(t.identifier('withZephyr'), [])])
            );
            objExpr.properties.push(newIntegrationsProperty);
            integrationAdded = true;
          }
        }
      }
    },
  });

  // If we didn't find a suitable pattern, fall back to the basic function transformer
  if (!integrationAdded) {
    addToAstroIntegrationsInFunction(ast);
  }
}
