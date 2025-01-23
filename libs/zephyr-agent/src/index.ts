// hack for angular
export { onIndexHtmlResolved, resolveIndexHtml } from './lib/hacks/resolve-index-html';
// qwik hack - persist
export {
  getPartialAssetMap,
  removePartialAssetMap,
  savePartialAssetMap,
} from './lib/node-persist/partial-assets-map';

// required for testing
export { type ZeApplicationConfig } from './lib/node-persist/upload-provider-options';
export {
  getAppConfig,
  saveAppConfig,
} from './lib/node-persist/application-configuration';
export { getGitInfo } from './lib/build-context/ze-util-get-git-info';
export { getPackageJson } from './lib/build-context/ze-util-read-package-json';
export { getSecretToken } from './lib/node-persist/secret-token';

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
