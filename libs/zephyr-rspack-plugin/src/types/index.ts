import type { ZephyrBuildHooks } from 'zephyr-agent';

export interface ZephyrRspackPluginOptions {
  // hacks
  // todo: add link to documentation and sample how this should be used and when
  wait_for_index_html?: boolean;
  hooks?: ZephyrBuildHooks;
}
