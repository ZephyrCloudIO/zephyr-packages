import type { ZephyrBuildHooks, ZephyrEngine } from 'zephyr-agent';

export interface ZephyrRspackPluginOptions {
  // hacks
  // todo: add link to documentation and sample how this should be used and when
  wait_for_index_html?: boolean;
  hooks?: ZephyrBuildHooks;
  /**
   * Disable internal per-compilation upload. Useful when wrapper plugins need to
   * aggregate artifacts across multiple environments before a single upload.
   */
  disable_upload?: boolean;
  /** Reuse an already initialized Zephyr engine (shared build lifecycle). */
  zephyr_engine?: ZephyrEngine;
  /** Optional snapshot type forwarded to upload assets. */
  snapshot_type?: 'csr' | 'ssr';
  /** Optional server entrypoint for SSR snapshots. */
  entrypoint?: string;
}
