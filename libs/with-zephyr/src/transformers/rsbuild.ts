import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { BabelNode } from '../types.js';
import { addToPluginsArrayOrCreate } from './plugins-array.js';

function isNamedKey(prop: t.ObjectProperty, name: string): boolean {
  return (
    (t.isIdentifier(prop.key) && prop.key.name === name) ||
    (t.isStringLiteral(prop.key) && prop.key.value === name)
  );
}

function ensureOutputAssetPrefixAuto(configObject: t.ObjectExpression): void {
  let outputProp: t.ObjectProperty | null = null;

  for (const prop of configObject.properties) {
    if (t.isObjectProperty(prop) && isNamedKey(prop, 'output')) {
      outputProp = prop;
      break;
    }
  }

  if (!outputProp) {
    configObject.properties.push(
      t.objectProperty(
        t.identifier('output'),
        t.objectExpression([
          t.objectProperty(t.identifier('assetPrefix'), t.stringLiteral('auto')),
        ])
      )
    );
    return;
  }

  if (!t.isObjectExpression(outputProp.value)) {
    // Unclear how to safely mutate non-literal output config.
    return;
  }

  const outputObj = outputProp.value;
  const hasAssetPrefix = outputObj.properties.some(
    (p) => t.isObjectProperty(p) && isNamedKey(p, 'assetPrefix')
  );
  if (!hasAssetPrefix) {
    outputObj.properties.push(
      t.objectProperty(t.identifier('assetPrefix'), t.stringLiteral('auto'))
    );
  }
}

/**
 * RSBuild needs output.assetPrefix = 'auto' for MF to work reliably.
 *
 * - Adds `withZephyr()` to the plugins array (creating plugins if needed).
 * - Ensures `output.assetPrefix: 'auto'` exists (without overwriting).
 */
export function addToRsbuildConfig(ast: BabelNode): void {
  // First: ensure withZephyr exists in plugins (handles defineConfig + fallbacks)
  addToPluginsArrayOrCreate(ast);

  // Then: ensure output.assetPrefix in each defineConfig({ ... })
  let touched = false;
  traverse(ast, {
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.callee, { name: 'defineConfig' }) &&
        path.node.arguments.length === 1 &&
        t.isObjectExpression(path.node.arguments[0])
      ) {
        ensureOutputAssetPrefixAuto(path.node.arguments[0]);
        touched = true;
      }
    },
  });

  // Fallback: plain object export default { ... }
  if (!touched) {
    traverse(ast, {
      ExportDefaultDeclaration(path) {
        if (t.isObjectExpression(path.node.declaration)) {
          ensureOutputAssetPrefixAuto(path.node.declaration);
        }
      },
    });
  }
}
