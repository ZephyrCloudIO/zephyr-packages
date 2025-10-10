import type { Node as BabelNode } from '@babel/types';

export type { BabelNode };

export interface BundlerPattern {
  type: string;
  matcher: RegExp;
  transform: string;
}

export interface BundlerConfig {
  files: string[];
  plugin: string;
  importName: string | null;
  patterns: BundlerPattern[];
}

export interface BundlerConfigs {
  [key: string]: BundlerConfig;
}

export interface ConfigFile {
  filePath: string;
  bundlerName: string;
  config: BundlerConfig;
}

export interface CodemodOptions {
  dryRun?: boolean;
  bundlers?: string[] | null;
  installPackages?: boolean;
}

export interface TransformFunction {
  (ast: BabelNode): void;
}

export interface TransformFunctions {
  [key: string]: TransformFunction;
}

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';
