import { initTelemetry } from './lib/telemetry';

// Initialize OpenTelemetry telemetry at startup
// Using void to explicitly mark as ignored since this is a top-level initialization
void initTelemetry();

// hack for angular
export { onIndexHtmlResolved, resolveIndexHtml } from './lib/hacks/resolve-index-html';
// qwik hack - persist
export {
  getPartialAssetMap,
  removePartialAssetMap,
  savePartialAssetMap,
} from './lib/node-persist/partial-assets-map';

// errors
export { ZeErrors, ZephyrError } from './lib/errors';

// deploy result
export {
  getAllAppDeployResults,
  getAllDeployedApps,
  getAppDeployResult,
  type DeployResult,
} from './lib/node-persist/app-deploy-result-cache';

// logger
export { ze_log } from './lib/logging';
export { logFn } from './lib/logging/ze-log-event';

// default transformers
export {
  applyBaseHrefToAssets,
  normalizeBasePath,
} from './lib/transformers/ze-basehref-handler';
export { zeBuildAssets } from './lib/transformers/ze-build-assets';
export {
  buildAssetsMap,
  type ZeBuildAssetsMap,
} from './lib/transformers/ze-build-assets-map';
export { zeBuildDashData } from './lib/transformers/ze-build-dash-data';

// Auth related exports
export { DEFAULT_AUTH_COMPLETION_TIMEOUT_MS, TOKEN_EXPIRY } from './lib/auth/auth-flags';

// Zephyr Edge is the main class which should be used
export {
  is_zephyr_dependency_pair,
  readPackageJson,
  ZephyrEngine,
  type ZeDependencyPair,
  type ZephyrDependencies,
  type ZephyrEngineOptions,
} from './zephyr-engine';
export type { Platform } from './zephyr-engine';
export type { ZeResolvedDependency } from './zephyr-engine/resolve_remote_dependency';
