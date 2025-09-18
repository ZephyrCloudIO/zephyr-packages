import fs from 'fs';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import type { BabelNode } from './types.js';

/** Parse JavaScript/TypeScript file into AST */
export function parseFile(filePath: string): BabelNode {
  const content = fs.readFileSync(filePath, 'utf8');
  const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');

  return parse(content, {
    sourceType: 'module',
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    plugins: [
      'jsx',
      'asyncGenerators',
      'bigInt',
      'classProperties',
      'decorators-legacy',
      'doExpressions',
      'dynamicImport',
      'exportDefaultFrom',
      'exportNamespaceFrom',
      'functionBind',
      'functionSent',
      'importMeta',
      'nullishCoalescingOperator',
      'numericSeparator',
      'objectRestSpread',
      'optionalCatchBinding',
      'optionalChaining',
      'throwExpressions',
      'topLevelAwait',
      ...(isTypeScript ? ['typescript' as const] : []),
    ],
  });
}

/** Generate code from AST and write to file */
export function writeFile(filePath: string, ast: BabelNode): void {
  const output = generate(ast, {
    retainLines: false,
    compact: false,
  });
  fs.writeFileSync(filePath, output.code);
}

/** Add import statement for withZephyr */
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

/** Check if withZephyr is already present in the configuration */
export function hasZephyrPlugin(ast: BabelNode): boolean {
  let hasPlugin = false;

  traverse(ast, {
    CallExpression(path) {
      if (t.isIdentifier(path.node.callee, { name: 'withZephyr' })) {
        hasPlugin = true;
      }
    },
    Identifier(path) {
      if (
        path.node.name === 'withZephyr' &&
        t.isCallExpression(path.parent) &&
        path.parent.callee === path.node
      ) {
        hasPlugin = true;
      }
    },
  });

  return hasPlugin;
}

/** Transform composePlugins call to add withZephyr */
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

/** Add withZephyr to plugins array */
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

/** Transform Vite config to add withZephyr */
export function addToVitePlugins(ast: BabelNode): void {
  addToPluginsArray(ast);
}

/** Transform Vite config with function wrapper to add withZephyr */
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

/** Transform Rollup function config */
export function addToRollupFunction(ast: BabelNode): void {
  traverse(ast, {
    ArrowFunctionExpression(path) {
      if (
        path.node.params.length === 1 &&
        t.isIdentifier(path.node.params[0], { name: 'config' })
      ) {
        // Add config.plugins.push(withZephyr());
        const pushStatement = t.expressionStatement(
          t.callExpression(
            t.memberExpression(
              t.memberExpression(t.identifier('config'), t.identifier('plugins')),
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

/** Transform Rolldown config */
export function addToRolldownPlugins(ast: BabelNode): void {
  addToPluginsArray(ast);
}

/** Transform Modern.js config */
export function addToModernJSPlugins(ast: BabelNode): void {
  addToPluginsArray(ast);
}

/** Transform RSPress config */
export function addToRSPressPlugins(ast: BabelNode): void {
  addToPluginsArray(ast);
}

/** Add to Parcel reporters (JSON config) */
export function addToParcelReporters(filePath: string, pluginName: string): void {
  const content = fs.readFileSync(filePath, 'utf8');
  const config = JSON.parse(content);

  if (!config.reporters) {
    config.reporters = [];
  }

  if (!config.reporters.includes(pluginName)) {
    config.reporters.push(pluginName);
  }

  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
}

/** Wrap module.exports with withZephyr */
export function wrapModuleExports(ast: BabelNode): void {
  traverse(ast, {
    AssignmentExpression(path) {
      if (
        t.isMemberExpression(path.node.left) &&
        t.isIdentifier(path.node.left.object, { name: 'module' }) &&
        t.isIdentifier(path.node.left.property, { name: 'exports' })
      ) {
        // Wrap the exported value with withZephyr call
        path.node.right = t.callExpression(t.identifier('withZephyr'), []);
      }
    },
  });
}

/** Wrap export default with withZephyr */
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

/** Handle Rollup array config */
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

/** Skip transformation if already wrapped */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function skipAlreadyWrapped(_ast: BabelNode): void {
  // This transformer does nothing - it's used to skip already wrapped configs
}

/**
 * Wrap exported function for Re.Pack configuration Pattern: export default config =>
 * export default withZephyr()(config)
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

/** Add Zephyr RSBuild plugin to RSBuild configuration */
export function addZephyrRSbuildPlugin(ast: BabelNode): void {
  // First, check if we need to add withZephyr import
  let hasWithZephyrImport = false;

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === 'zephyr-rspack-plugin') {
        const specifiers = path.node.specifiers;
        for (const spec of specifiers) {
          if (
            t.isImportSpecifier(spec) &&
            t.isIdentifier(spec.imported, { name: 'withZephyr' })
          ) {
            hasWithZephyrImport = true;
          }
        }
      }
    },
  });

  if (!hasWithZephyrImport) {
    // Add withZephyr import
    const importDeclaration = t.importDeclaration(
      [t.importSpecifier(t.identifier('withZephyr'), t.identifier('withZephyr'))],
      t.stringLiteral('zephyr-rspack-plugin')
    );

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

  // Then, add the zephyrRSbuildPlugin function if it doesn't exist
  let hasZephyrPlugin = false;

  traverse(ast, {
    VariableDeclarator(path) {
      if (t.isIdentifier(path.node.id, { name: 'zephyrRSbuildPlugin' })) {
        hasZephyrPlugin = true;
      }
    },
  });

  if (!hasZephyrPlugin) {
    // Create the zephyrRSbuildPlugin function as AST nodes
    const zephyrPluginFunction = t.variableDeclaration('const', [
      t.variableDeclarator(
        t.identifier('zephyrRSbuildPlugin'),
        t.arrowFunctionExpression(
          [],
          t.objectExpression([
            t.objectProperty(
              t.identifier('name'),
              t.stringLiteral('zephyr-rsbuild-plugin')
            ),
            t.objectMethod(
              'method',
              t.identifier('setup'),
              [t.identifier('api')],
              t.blockStatement([
                t.expressionStatement(
                  t.callExpression(
                    t.memberExpression(
                      t.identifier('api'),
                      t.identifier('modifyRspackConfig')
                    ),
                    [
                      t.arrowFunctionExpression(
                        [t.identifier('config')],
                        t.blockStatement([
                          t.variableDeclaration('const', [
                            t.variableDeclarator(
                              t.identifier('zephyrConfig'),
                              t.awaitExpression(
                                t.callExpression(
                                  t.callExpression(t.identifier('withZephyr'), []),
                                  [t.identifier('config')]
                                )
                              )
                            ),
                          ]),
                          t.expressionStatement(
                            t.assignmentExpression(
                              '=',
                              t.identifier('config'),
                              t.identifier('zephyrConfig')
                            )
                          ),
                        ]),
                        true // async
                      ),
                    ]
                  )
                ),
              ])
            ),
          ])
        )
      ),
    ]);

    // Add type annotation (currently unused but may be needed for future type handling)
    // const functionWithType = t.tsTypeAnnotation(
    //   t.tsTypeReference(t.identifier('RsbuildPlugin'), null)
    // );

    traverse(ast, {
      Program(path) {
        // Find the last import statement and insert after it
        let insertIndex = 0;
        for (let i = 0; i < path.node.body.length; i++) {
          if (t.isImportDeclaration(path.node.body[i])) {
            insertIndex = i + 1;
          } else {
            break;
          }
        }

        // Insert the plugin function
        path.node.body.splice(insertIndex, 0, zephyrPluginFunction);
        path.stop();
      },
    });

    // Also add RsbuildPlugin import if not present
    let hasRsbuildPluginImport = false;
    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === '@rsbuild/core') {
          const specifiers = path.node.specifiers;
          for (const spec of specifiers) {
            if (
              t.isImportSpecifier(spec) &&
              t.isIdentifier(spec.imported, { name: 'RsbuildPlugin' })
            ) {
              hasRsbuildPluginImport = true;
            }
          }

          // Add RsbuildPlugin to existing import if not present
          if (!hasRsbuildPluginImport) {
            specifiers.push(
              t.importSpecifier(
                t.identifier('RsbuildPlugin'),
                t.identifier('RsbuildPlugin')
              )
            );
          }
        }
      },
    });
  }

  // Now add zephyrRSbuildPlugin() to the plugins array
  traverse(ast, {
    ObjectProperty(path) {
      if (
        t.isIdentifier(path.node.key, { name: 'plugins' }) &&
        t.isArrayExpression(path.node.value)
      ) {
        // Check if zephyrRSbuildPlugin() is already in the array
        let hasZephyrInPlugins = false;
        for (const element of path.node.value.elements) {
          if (
            t.isCallExpression(element) &&
            t.isIdentifier(element.callee, { name: 'zephyrRSbuildPlugin' })
          ) {
            hasZephyrInPlugins = true;
            break;
          }
        }

        if (!hasZephyrInPlugins) {
          path.node.value.elements.push(
            t.callExpression(t.identifier('zephyrRSbuildPlugin'), [])
          );
        }
      }
    },
  });
}
