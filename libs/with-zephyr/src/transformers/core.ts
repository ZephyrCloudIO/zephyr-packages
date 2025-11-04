import fs from 'fs';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import type { BabelNode } from '../types.js';

const traverse = (traverseModule as any).default || traverseModule;

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

/** Check if withZephyr is already present in the configuration */
export function hasZephyrPlugin(ast: BabelNode): boolean {
  let hasPlugin = false;

  traverse(ast, {
    CallExpression(path) {
      if (t.isIdentifier(path.node.callee, { name: 'withZephyr' })) {
        hasPlugin = true;
      }
    },
  });

  return hasPlugin;
}

/**
 * Skip transformation if already wrapped This is a no-op transformer used for pattern
 * matching
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function skipAlreadyWrapped(_ast: BabelNode): void {
  // This transformer does nothing - it's used to skip already wrapped configs
}
