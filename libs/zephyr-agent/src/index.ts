// hack for angular
export { onIndexHtmlResolved, resolveIndexHtml } from './lib/hacks/resolve-index-html';
// qwik hack - persist
export {
  getPartialAssetMap,
  removePartialAssetMap,
  savePartialAssetMap,
} from './lib/node-persist/partial-assets-map';

// errors
export { ZephyrError, ZeErrors } from './lib/errors';

// logger
export { ze_log } from './lib/logging';
export { logFn } from './lib/logging/ze-log-event';

// default transformers
export {
  buildAssetsMap,
  type ZeBuildAssetsMap,
} from './lib/transformers/ze-build-assets-map';
export { zeBuildDashData } from './lib/transformers/ze-build-dash-data';
export { zeBuildAssets } from './lib/transformers/ze-build-assets';

// Zephyr Edge is the main class which should be used
export {
  ZephyrEngine,
  is_zephyr_dependency_pair,
  type ZeDependencyPair,
  type ZephyrDependencies,
  readPackageJson,
} from './zephyr-engine';
export type { ZeResolvedDependency } from './zephyr-engine/resolve_remote_dependency';

// @lois tech dept to remove after repack fix
export { get_missing_assets } from './lib/edge-hash-list/get-missing-assets';
export * from './lib/logging/picocolor';
export { verify_mf_fastly_config } from './lib/build-context/ze-util-verification';
export { resolve_remote_dependency } from './zephyr-engine/resolve_remote_dependency';
export {
  getAppDeployResult,
  setAppDeployResult,
} from './lib/node-persist/app-deploy-result-cache';
