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

// Auth related exports
export { DEFAULT_AUTH_COMPLETION_TIMEOUT_MS, TOKEN_EXPIRY } from './lib/auth/auth-flags';

// Zephyr Edge is the main class which should be used
export {
  ZephyrEngine,
  is_zephyr_dependency_pair,
  is_zephyr_resolved_dependency,
  type ZeDependencyPair,
  type ZephyrDependencies,
  type ZephyrEngineOptions,
  type ZephyrEngineBuilderTypes,
  type ZeApplicationProperties,
  type DeferredZephyrEngine,
  readPackageJson,
  read_package_json,
  mut_zephyr_app_uid,
  create_zephyr_engine,
  defer_create_zephyr_engine,
  resolve_remote_dependencies_for_engine,
  start_new_build_for_engine,
  build_finished_for_engine,
  upload_assets_for_engine,
} from './zephyr-engine';
export type { ZeResolvedDependency } from './zephyr-engine/resolve_remote_dependency';
export type { Platform } from './zephyr-engine';
