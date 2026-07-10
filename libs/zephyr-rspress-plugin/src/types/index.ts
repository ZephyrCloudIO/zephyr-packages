import type { ZephyrEngine, ZephyrBuildHooks } from 'zephyr-agent';
import type { XStats, XStatsCompilation } from 'zephyr-xpack-internal';

export interface ZephyrRspressPluginOptions {
  deferEngine: Promise<ZephyrEngine>;
  outDir: string;
  files: string[];
  hooks?: ZephyrBuildHooks;
}

/**
 * Generic type for rspress SSG config that works with both v1 and v2 v1: boolean | {
 * strict?: boolean } v2: boolean | { experimentalWorker?: boolean;
 * experimentalExcludeRoutePaths?: (string | RegExp)[] }
 */
export type SSGConfig = boolean | Record<string, unknown>;

/**
 * Minimal builder config shape for plugin injection Both rspress v1 and v2 support this
 * shape for their builder configuration
 */
export interface BuilderConfigWithPlugins {
  plugins?: unknown[];
}

/**
 * Generic rspress user config that works with both v1 and v2 Uses intersection of both
 * config shapes. The index signature is intentionally omitted to allow compatibility with
 * stricter types like RsbuildConfig that don't have index signatures.
 */
export interface RspressUserConfig {
  ssg?: SSGConfig;
  root?: string;
  outDir?: string;
  // v1 API
  builderPlugins?: unknown[];
  // v2 API - use minimal shape to avoid index signature conflicts
  builderConfig?: BuilderConfigWithPlugins;
}

/**
 * Generic rspress plugin interface that works with both v1 and v2 Uses a generic config
 * type parameter with default
 */
export interface RspressPlugin<TConfig extends RspressUserConfig = RspressUserConfig> {
  name: string;
  config?: (
    config: TConfig,
    utils: {
      addPlugin: (plugin: RspressPlugin<TConfig>) => void;
      removePlugin: (pluginName: string) => void;
    },
    isProd: boolean
  ) => TConfig | Promise<TConfig>;
  afterBuild?: () => void | Promise<void>;
}

export interface StatsAsset {
  name: string;
  size?: number;
  emitted?: boolean;
  chunkNames?: string[];
  info?: {
    minimized?: boolean;
    related?: Record<string, string[]>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type StatsCompilation = XStatsCompilation & {
  assets?: StatsAsset[];
  errors?: unknown[];
  warnings?: unknown[];
  outputPath?: string;
};

export type Stats = XStats & {
  compilation: XStats['compilation'] & {
    options: {
      context: string;
    };
    assets?: StatsAsset[];
  };
  toJson: (options?: unknown) => StatsCompilation;
};
