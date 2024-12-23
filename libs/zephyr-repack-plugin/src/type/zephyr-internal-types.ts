import { Configuration } from '@rspack/core';
import type { Stats, StatsCompilation } from '@rspack/core';
import { Source } from 'zephyr-edge-contract';
import { ZephyrRepackPluginOptions } from '../lib/ze-repack-plugin';

export interface DelegateConfig {
  org: string;
  project: string;
  application?: undefined;
  target?: 'ios' | 'android' | 'web' | undefined;
}

export type RepackRspackConfig = Configuration;

export interface ResolvedDependency {
  remote_name: string;
  default_url: string;
  application_uid: string;
  remote_entry_url: string;
  library_type: string;
}

export interface ZephyrAgentProps {
  stats: Stats;
  stats_json: StatsCompilation;
  pluginOptions: ZephyrRepackPluginOptions;
  assets: Record<string, Source>;
}
