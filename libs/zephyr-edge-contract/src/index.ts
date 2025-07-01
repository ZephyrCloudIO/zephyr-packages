/* istanbul ignore file */

// edge api
export type {
  PublishRequest,
  StageZeroPublishRequest,
  PublishTarget,
} from './lib/edge-api/publish-request';
export type {
  ZeEnvs,
  ZeUploadBuildStats,
  ApplicationVariableItem,
  ResolveApplicationVariablesBody,
  ResolveApplicationVariablesResponse,
} from './lib/edge-api/ze-envs-request';

export type { ZephyrPluginOptions } from './lib/plugin-options/zephyr-webpack-plugin-options';
export type {
  Snapshot,
  SnapshotAsset,
  SnapshotMetadata,
  SnapshotWithVariables,
  SnapshotVariables,
} from './lib/snapshot';
export { createApplicationUid } from './lib/utils/create-application-uid';
export { createSnapshotId, flatCreateSnapshotId } from './lib/utils/create-snapshot-id';
export * as ZeUtils from './lib/promise';
export { safe_json_parse } from './lib/utils/safe-json-parse';
export type { ZeApplicationList } from './lib/ze-api/app-list';
export type { ZeAppVersion, ZeAppVersionResponse } from './lib/ze-api/app-version';
export type { ConvertedGraph } from './lib/ze-api/converted-graph';
export type { LocalPackageJson } from './lib/ze-api/local-package-json';
export type { ZephyrBuildStats } from './lib/zephyr-build-stats';
export type {
  Asset,
  SnapshotUploadRes,
  Source,
  UploadableAsset,
  ZeBuildAsset,
  ZeBuildAssetsMap,
  ZeUploadAssetsOptions,
} from './lib/zephyr-edge-contract';

// api contract negotiation
export {
  ZEPHYR_API_ENDPOINT,
  ZE_API_ENDPOINT,
  ZE_IS_PREVIEW,
  ze_api_gateway,
  ZE_API_ENDPOINT_HOST,
} from './lib/api-contract-negotiation/get-api-contract';

// promise proto methods
export {
  forEachLimit,
  PromiseTuple,
  isSuccessTuple,
  PromiseLazyLoad,
  PromiseWithResolvers,
  deferred,
} from './lib/promise';

// zephyr runtime
export { ZephyrRuntimeConstants } from './lib/zephyr-runtime/constants';
export { type DependenciesRecord } from './lib/zephyr-runtime/dependencies-record';
export { createZephyrRuntimeFile } from './lib/zephyr-runtime/generator';
export {
  createVariablesRecord,
  type VariablesRecord,
} from './lib/zephyr-runtime/variables-record';

// string proto methods
export { type FindTemplates, formatString } from './lib/string/string';
export { stripAnsi } from './lib/string/strip-ansi';
