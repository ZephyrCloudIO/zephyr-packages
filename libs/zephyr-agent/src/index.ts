// hack for angular
export { onIndexHtmlResolved, resolveIndexHtml } from './lib/hacks/resolve-index-html';
// qwik hack - persist
export {
  getPartialAssetMap,
  removePartialAssetMap,
  savePartialAssetMap,
} from './lib/node-persist/partial-assets-map';

// global utilities
export { getGlobal } from './lib/utils/get-global';
export {
  readDirRecursive,
  readDirRecursiveWithContents,
  type FileInfo,
} from './lib/utils/read-dir-recursive';

// errors
export { ZeErrors, ZephyrError } from './lib/errors';
export { handleGlobalError } from './lib/errors';

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
export {
  initializeLogRun,
  getCurrentRunDir,
  resetLogRun,
  writeLogToFile,
  writeRunSummary,
  isFileLoggingEnabled,
  getLogBasePath,
  getLogFormat,
  type StructuredLogData,
} from './lib/logging/file-logger';

// default transformers
export {
  applyBaseHrefToAssets,
  normalizeBasePath,
} from './lib/transformers/ze-basehref-handler';
export { zeBuildAssets } from './lib/transformers/ze-build-assets';
export {
  buildAssetsMapMock as buildAssetsMap,
  type ZeBuildAssetsMap,
} from './lib/transformers/ze-build-assets-map';
export { zeBuildDashData } from './lib/transformers/ze-build-dash-data';
export {
  convertResolvedDependencies,
  createManifestAsset,
  createManifestContent,
  createZephyrManifest,
} from './lib/transformers/ze-create-manifest';

// Auth related exports
export { DEFAULT_AUTH_COMPLETION_TIMEOUT_MS, TOKEN_EXPIRY } from './lib/auth/auth-flags';
export { checkAuth } from './lib/auth/login';
export { getGitInfo, type ZeGitInfo } from './lib/build-context/ze-util-get-git-info';
export { getToken as getAuthToken } from './lib/node-persist/token';

// Zephyr Edge is the main class which should be used
export {
  ZephyrEngine,
  is_zephyr_dependency_pair,
  readPackageJson,
  type ZeDependencyPair,
  type ZephyrDependencies,
  type ZephyrEngineOptions,
} from './zephyr-engine';
export type { Platform, ZephyrBuildHooks, DeploymentInfo } from './zephyr-engine';
export type { ZeResolvedDependency } from './zephyr-engine/resolve_remote_dependency';

// Environment variable utilities
export {
  buildEnvImportMap,
  buildEnvImportMapScript,
  buildEnvModuleSource,
  rewriteEnvReadsToVirtualModule,
  type RemoteEntry,
  VIRTUAL_SPECIFIER,
  detectEnvReads,
  buildImportMap,
  injectImportMap,
  buildModulePreload,
  injectBeforeHeadClose,
  buildEnvJsonAsset,
  generateManifestContent,
  calculateManifestHash,
  collectZEPublicVars,
} from './lib/env-variables';
