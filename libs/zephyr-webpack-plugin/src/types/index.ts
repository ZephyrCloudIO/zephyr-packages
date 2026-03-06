import type { ZephyrBuildHooks } from 'zephyr-agent';
import type { ZephyrFederationHmrOptions } from 'zephyr-xpack-internal';

export interface ZephyrWebpackPluginOptions {
  // hacks
  // todo: add link to documentation and sample how this should be used and when
  wait_for_index_html?: boolean;
  hooks?: ZephyrBuildHooks;
  federationHmr?: boolean | ZephyrFederationHmrOptions;
}
