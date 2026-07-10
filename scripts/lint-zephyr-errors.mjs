import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const sourceRoots = ['libs', 'packages'].map((directory) => path.join(workspaceRoot, directory));
const ignoredDirectories = new Set(['coverage', 'dist', 'lib', 'node_modules', 'scripts', 'tmp']);
const sourcePattern = /\.[cm]?[jt]sx?$/;
const testPattern = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const violations = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      (ignoredDirectories.has(entry.name) || entry.name.includes('legacy'))
    ) {
      continue;
    }
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath);
    } else if (sourcePattern.test(entry.name) && !testPattern.test(entry.name)) {
      inspectFile(absolutePath);
    }
  }
}

function inspectFile(file) {
  const sourceText = fs.readFileSync(file, 'utf8');
  const sourceLines = sourceText.split(/\r?\n/u);
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  function visit(node) {
    if (
      ts.isThrowStatement(node) &&
      node.expression &&
      ts.isNewExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Error' &&
      !isRestrictionDisabled(node)
    ) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      violations.push(
        `${path.relative(workspaceRoot, file)}:${position.line + 1}:${position.character + 1}: Use ZephyrError instead of Error`
      );
    }
    ts.forEachChild(node, visit);
  }

  function isRestrictionDisabled(node) {
    const start = node.getStart();
    const position = sourceFile.getLineAndCharacterOfPosition(start);
    const previousLine = sourceLines[position.line - 1] ?? '';
    const currentLine = sourceLines[position.line] ?? '';

    if (
      /eslint-disable-next-line\s+no-restricted-syntax/u.test(previousLine) ||
      /eslint-disable-line\s+no-restricted-syntax/u.test(currentLine)
    ) {
      return true;
    }

    const precedingSource = sourceText.slice(0, start);
    return (
      precedingSource.lastIndexOf('eslint-disable no-restricted-syntax') >
      precedingSource.lastIndexOf('eslint-enable no-restricted-syntax')
    );
  }

  visit(sourceFile);
}

for (const sourceRoot of sourceRoots) walk(sourceRoot);

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log('ZephyrError restriction verified.');
}
