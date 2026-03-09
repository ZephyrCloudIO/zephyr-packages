export type BundlerStrategy = 'first-success' | 'run-all';

export type BundlerOperationId =
  | 'compose-plugins'
  | 'plugins-array'
  | 'plugins-array-or-create'
  | 'wrap-module-exports'
  | 'wrap-module-exports-async'
  | 'wrap-export-default-async'
  | 'wrap-export-default-define-config'
  | 'wrap-export-default-object'
  | 'rollup-function'
  | 'rollup-array'
  | 'astro-integrations-or-create'
  | 'astro-integrations-function-or-create'
  | 'rsbuild-asset-prefix'
  | 'wrap-exported-function'
  | 'parcel-reporters';

export interface BundlerConfig {
  files: string[];
  plugin: string;
  importName: string | null;
  strategy: BundlerStrategy;
  operations: BundlerOperationId[];
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

export interface OperationResult {
  status: 'changed' | 'no-match' | 'error';
  error?: string;
}

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';
