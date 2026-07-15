import type { ZephyrBuildHooks, ZephyrBuildTarget, ZephyrEngine } from 'zephyr-agent';
import type { XPackBuildCoordinator } from 'zephyr-xpack-internal';

export interface ZephyrRspackPluginOptions {
  /** Zephyr build target, including the `tap-app` mini-app artifact family. */
  target?: ZephyrBuildTarget;
  /** Wait for HTML processing before deployment when the framework emits HTML late. */
  wait_for_index_html?: boolean;
  hooks?: ZephyrBuildHooks;
  /** Override automatic CSR/SSR detection for coordinated compiler arrays. */
  snapshotType?: 'csr' | 'ssr';
  /** Server entrypoint relative to the shared output root. */
  entrypoint?: string;
  /** Framework integration only: shared logical-build state for compiler wrappers. */
  __engine?: ZephyrEngine;
  /** Framework integration only. */
  __coordinator?: XPackBuildCoordinator;
  /** Framework integration only. */
  __participant?: string;
  /** Framework integration only. */
  __assetPrefix?: string;
}
