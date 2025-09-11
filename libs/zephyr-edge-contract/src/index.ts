/* istanbul ignore file */

// edge api
export type {
  GatewayPublishRequest,
  PublishRequest,
  PublishTarget,
  PublishTargets,
  StageZeroPublishRequest,
} from './lib/edge-api/publish-request';
export type { ZeEnvs, ZeUploadBuildStats } from './lib/edge-api/ze-envs-request';

export type { ZephyrPluginOptions } from './lib/plugin-options/zephyr-webpack-plugin-options';
export * as ZeUtils from './lib/promise';
export type { Snapshot, SnapshotAsset, SnapshotMetadata } from './lib/snapshot';
export { createApplicationUid } from './lib/utils/create-application-uid';
export { createSnapshotId, flatCreateSnapshotId } from './lib/utils/create-snapshot-id';
export { normalize_js_var_name as normalize_app_name } from './lib/utils/normalize-js-var-name';
export { safe_json_parse } from './lib/utils/safe-json-parse';
export type { ZeApplicationList } from './lib/ze-api/app-list';
export type { ZeAppVersion, ZeAppVersionResponse } from './lib/ze-api/app-version';
export type { ConvertedGraph } from './lib/ze-api/converted-graph';
export type { LocalPackageJson } from './lib/ze-api/local-package-json';
export type { ZephyrBuildStats, ZephyrDependency } from './lib/zephyr-build-stats';
export type {
  Asset,
  SnapshotUploadRes,
  Source,
  UploadableAsset,
  ZeBuildAsset,
  ZeBuildAssetsMap,
  ZeUploadAssetsOptions,
} from './lib/zephyr-edge-contract';
export { ZEPHYR_MANIFEST_VERSION, type ZephyrManifest } from './lib/zephyr-manifest';

// api contract negotiation
export {
  ZE_API_ENDPOINT,
  ZE_API_ENDPOINT_HOST,
  ze_api_gateway,
  ZE_IS_PREVIEW,
  ZEPHYR_API_ENDPOINT,
} from './lib/api-contract-negotiation/get-api-contract';

// promise proto methods
export {
  deferred,
  forEachLimit,
  isSuccessTuple,
  PromiseLazyLoad,
  PromiseTuple,
  PromiseWithResolvers,
} from './lib/promise';

// string proto methods
export { formatString, type FindTemplates } from './lib/string/string';
export { stripAnsi } from './lib/string/strip-ansi';
