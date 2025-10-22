import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { BabelNode } from '../types.js';

/** Add import statement for withZephyr (ESM) */
export function addZephyrImport(
  ast: BabelNode,
  pluginName: string,
  importName: string | null
): void {
  if (!importName) return;

  let hasImport = false;

  // Check if import already exists
  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === pluginName) {
        hasImport = true;
      }
    },
  });

  if (!hasImport) {
    const importDeclaration = t.importDeclaration(
      [t.importSpecifier(t.identifier(importName), t.identifier(importName))],
      t.stringLiteral(pluginName)
    );

    // Find the first import or add at the beginning
    traverse(ast, {
      Program(path) {
        const firstImportIndex = path.node.body.findIndex((node) =>
          t.isImportDeclaration(node)
        );

        if (firstImportIndex >= 0) {
          path.node.body.splice(firstImportIndex + 1, 0, importDeclaration);
        } else {
          path.node.body.unshift(importDeclaration);
        }
        path.stop();
      },
    });
  }
}

/** Add require statement for withZephyr (CommonJS) */
export function addZephyrRequire(
  ast: BabelNode,
  pluginName: string,
  importName: string | null
): void {
  if (!importName) return;

  let hasRequire = false;

  // Check if require already exists
  traverse(ast, {
    VariableDeclarator(path) {
      if (
        t.isCallExpression(path.node.init) &&
        t.isIdentifier(path.node.init.callee, { name: 'require' }) &&
        t.isStringLiteral(path.node.init.arguments[0]) &&
        path.node.init.arguments[0].value === pluginName
      ) {
        hasRequire = true;
      }
    },
  });

  if (!hasRequire) {
    const requireStatement = t.variableDeclaration('const', [
      t.variableDeclarator(
        t.objectPattern([
          t.objectProperty(
            t.identifier(importName),
            t.identifier(importName),
            false,
            true
          ),
        ]),
        t.callExpression(t.identifier('require'), [t.stringLiteral(pluginName)])
      ),
    ]);

    // Add at the beginning of the file
    traverse(ast, {
      Program(path) {
        path.node.body.unshift(requireStatement);
        path.stop();
      },
    });
  }
}
