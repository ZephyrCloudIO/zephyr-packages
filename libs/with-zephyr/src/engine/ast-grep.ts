import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

export type AstGrepLanguage = 'js' | 'ts' | 'json';

export interface AstGrepRunOptions {
  filePath: string;
  pattern: string;
  selector?: string;
  strictness?: 'cst' | 'smart' | 'ast' | 'relaxed' | 'signature' | 'template';
  language?: AstGrepLanguage;
}

export interface AstGrepRewriteOptions extends AstGrepRunOptions {
  rewrite: string;
  updateAll?: boolean;
}

export interface AstGrepResult {
  status: 'match' | 'no-match' | 'error';
  stderr: string;
  stdout: string;
}

function resolveSgBinary(): string {
  const envBinary = process.env.ZEPHYR_SG_PATH;
  if (envBinary && envBinary.trim().length > 0) {
    return envBinary.trim();
  }

  const require = createRequire(import.meta.url);
  try {
    const packageJsonPath = require.resolve('@ast-grep/cli/package.json');
    const packageDir = path.dirname(packageJsonPath);
    const binaryName = process.platform === 'win32' ? 'sg.cmd' : 'sg';
    const candidate = path.join(packageDir, binaryName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  } catch {
    // fall through
  }

  return 'sg';
}

function detectLanguage(filePath: string): AstGrepLanguage {
  if (filePath.endsWith('.json') || path.basename(filePath) === '.parcelrc') {
    return 'json';
  }

  if (
    filePath.endsWith('.ts') ||
    filePath.endsWith('.mts') ||
    filePath.endsWith('.tsx')
  ) {
    return 'ts';
  }

  return 'js';
}

function shouldDisableHiddenIgnore(filePath: string): boolean {
  return path.basename(filePath).startsWith('.');
}

function runAstGrep(args: string[]): AstGrepResult {
  const runWithBinary = (binary: string, binaryArgs: string[]) =>
    spawnSync(binary, binaryArgs, {
      encoding: 'utf8',
    });

  const result = runWithBinary(resolveSgBinary(), args);

  const stderr = result.stderr ?? '';
  const isBrokenBootstrap =
    stderr.includes('This script should have been replaced') ||
    stderr.includes('line 1: This: command not found') ||
    stderr.includes('line 2: N.B.: command not found');
  const canFallbackByError =
    result.error?.code === 'ENOEXEC' || result.error?.code === 'ENOENT';

  const fallbackResult =
    isBrokenBootstrap || canFallbackByError
      ? runWithBinary('pnpm', ['--package=@ast-grep/cli', 'dlx', 'sg', ...args])
      : null;

  const effectiveResult = fallbackResult ?? result;

  if (effectiveResult.error) {
    return {
      status: 'error',
      stdout: '',
      stderr: effectiveResult.error.message,
    };
  }

  const effectiveStderr = effectiveResult.stderr ?? '';
  const effectiveStdout = effectiveResult.stdout ?? '';

  if (effectiveResult.status === 0) {
    return {
      status: 'match',
      stdout: effectiveStdout,
      stderr: effectiveStderr,
    };
  }

  if (effectiveResult.status === 1) {
    return {
      status: 'no-match',
      stdout: effectiveStdout,
      stderr: effectiveStderr,
    };
  }

  return {
    status: 'error',
    stdout: effectiveStdout,
    stderr:
      effectiveStderr ||
      effectiveStdout ||
      `ast-grep failed with exit code ${effectiveResult.status}`,
  };
}

export function searchWithAstGrep(options: AstGrepRunOptions): AstGrepResult {
  const language = options.language ?? detectLanguage(options.filePath);
  const args = [
    'run',
    '--lang',
    language,
    '--pattern',
    options.pattern,
    '--color',
    'never',
  ];

  if (options.selector) {
    args.push('--selector', options.selector);
  }

  if (options.strictness) {
    args.push('--strictness', options.strictness);
  }

  if (shouldDisableHiddenIgnore(options.filePath)) {
    args.push('--no-ignore', 'hidden');
  }

  args.push(options.filePath);
  return runAstGrep(args);
}

export function rewriteWithAstGrep(options: AstGrepRewriteOptions): AstGrepResult {
  const language = options.language ?? detectLanguage(options.filePath);
  const args = [
    'run',
    '--lang',
    language,
    '--pattern',
    options.pattern,
    '--rewrite',
    options.rewrite,
    '--color',
    'never',
  ];

  if (options.selector) {
    args.push('--selector', options.selector);
  }

  if (options.strictness) {
    args.push('--strictness', options.strictness);
  }

  if (shouldDisableHiddenIgnore(options.filePath)) {
    args.push('--no-ignore', 'hidden');
  }

  if (options.updateAll) {
    args.push('--update-all');
  }

  args.push(options.filePath);
  return runAstGrep(args);
}
