import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { BabelNode } from '../types.js';

/**
 * Add withZephyr to existing plugins array Finds any `plugins: [...]` property and
 * appends withZephyr() call
 */
export function addToPluginsArray(ast: BabelNode): void {
  traverse(ast, {
    ObjectProperty(path) {
      if (
        t.isIdentifier(path.node.key, { name: 'plugins' }) &&
        t.isArrayExpression(path.node.value)
      ) {
        path.node.value.elements.push(t.callExpression(t.identifier('withZephyr'), []));
      }
    },
  });
}

/**
 * Add withZephyr to plugins array in defineConfig, creating the array if it doesn't exist
 *
 * This transformer:
 *
 * 1. Looks for defineConfig({ ... }) calls
 * 2. If plugins array exists, adds withZephyr() to it
 * 3. If no plugins array exists, creates one with withZephyr()
 * 4. Falls back to addToPluginsArray if no defineConfig found
 */
export function addToPluginsArrayOrCreate(ast: BabelNode): void {
  let pluginAdded = false;

  traverse(ast, {
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.callee, { name: 'defineConfig' }) &&
        path.node.arguments.length === 1 &&
        t.isObjectExpression(path.node.arguments[0])
      ) {
        const configObject = path.node.arguments[0];
        let pluginsProperty: t.ObjectProperty | null = null;

        // Look for existing plugins property
        for (const prop of configObject.properties) {
          if (
            t.isObjectProperty(prop) &&
            t.isIdentifier(prop.key, { name: 'plugins' }) &&
            t.isArrayExpression(prop.value)
          ) {
            pluginsProperty = prop;
            break;
          }
        }

        if (pluginsProperty && t.isArrayExpression(pluginsProperty.value)) {
          // Add to existing plugins array
          pluginsProperty.value.elements.push(
            t.callExpression(t.identifier('withZephyr'), [])
          );
          pluginAdded = true;
        } else if (!pluginsProperty) {
          // Create new plugins array with withZephyr
          const newPluginsProperty = t.objectProperty(
            t.identifier('plugins'),
            t.arrayExpression([t.callExpression(t.identifier('withZephyr'), [])])
          );
          configObject.properties.push(newPluginsProperty);
          pluginAdded = true;
        }
      }
    },
  });

  // If we didn't find a defineConfig call, fall back to looking for any plugins array
  if (!pluginAdded) {
    addToPluginsArray(ast);
  }
}

/**
 * Transform composePlugins call to add withZephyr Used by Nx-style webpack/rspack configs
 *
 * Transforms: composePlugins(withNx(), withReact(), (config) => config) To:
 * composePlugins(withNx(), withReact(), withZephyr(), (config) => config)
 */
export function addToComposePlugins(ast: BabelNode): void {
  traverse(ast, {
    CallExpression(path) {
      if (t.isIdentifier(path.node.callee, { name: 'composePlugins' })) {
        // Add withZephyr() call as the last argument before the config function
        const args = path.node.arguments;
        const lastArg = args[args.length - 1];

        // If last argument is a function, insert before it
        if (t.isArrowFunctionExpression(lastArg) || t.isFunctionExpression(lastArg)) {
          args.splice(-1, 0, t.callExpression(t.identifier('withZephyr'), []));
        } else {
          args.push(t.callExpression(t.identifier('withZephyr'), []));
        }
      }
    },
  });
}
