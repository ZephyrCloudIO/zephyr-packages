import { Stats, StatsCompilation } from '@rspack/core';
import { ZephyrRepackPluginOptions } from '../lib/ze-repack-plugin';

// TODO: annotate what each field does and where they should come from
export interface FederationDashboardPluginOptions {
  app?: {
    // git org
    org: string;
    // git repo
    project: string;
    // package.json name
    name: string;
    // package.json version
    version: string;
  };
  // todo: what if git not configured? - skip for now
  git?: {
    name?: string;
    email?: string;
    branch: string;
    commit: string;
  };

  context: {
    isCI: boolean;
  };

  target: 'ios' | 'android' | 'web' | undefined;
  debug: boolean;
  filename: string;
  useAST: boolean;
  standalone?: boolean;
  dashboardURL?: string;
  metadata?: Record<string, string | { url: string }>;
  environment?: string;

  versionStrategy?: string;
  posted?: Date;
  group?: string;
  nextjs?: string;
  packageJsonPath?: string;
}

export interface Source {
  source: () => Buffer;
  size: () => number;
}

export type Exposes = (string | ExposesObject)[] | ExposesObject;

interface ExposesObject {
  [index: string]: string | ExposesConfig | string[];
}

/** Advanced configuration for modules that should be exposed by this container. */
interface ExposesConfig {
  /** Request to a module that should be exposed by this container. */
  import: string | string[];

  /** Custom chunk name for the exposed module. */
  name?: string;
}

export interface ProcessRspackGraphParams {
  stats: Stats;
  stats_json: StatsCompilation;
  pluginOptions: ZephyrRepackPluginOptions;
}

export interface TopLevelPackage {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;

  [key: string]: TopLevelPackage[keyof TopLevelPackage];
}
