import type { ZeBuildAssetsMap, ZephyrBuildStats } from 'zephyr-edge-contract';

// Import for re-export
import { read_package_json } from './read_package_json';
import type { ZephyrEngine } from './zephyr_engine';
// Re-export types and functions from extracted files
export { build_finished_for_engine } from './build_finished_for_engine';
export { create_zephyr_engine } from './create_zephyr_engine';
export type { Platform } from './create_zephyr_engine';
export { defer_create_zephyr_engine } from './defer_create_zephyr_engine';
export type {
  DeferredZephyrEngine,
  ZephyrEngineBuilderTypes,
  ZephyrEngineOptions,
} from './defer_create_zephyr_engine';
export { is_zephyr_dependency_pair } from './is_zephyr_dependency_pair';
export type { ZeDependencyPair } from './is_zephyr_dependency_pair';
export { is_zephyr_resolved_dependency } from './is_zephyr_resolved_dependency';
export { mut_zephyr_app_uid } from './mut_zephyr_app_uid';
export type { ZeApplicationProperties } from './mut_zephyr_app_uid';
export { read_package_json } from './read_package_json';
export type { ZephyrDependencies } from './read_package_json';
export { resolve_remote_dependencies_for_engine } from './resolve_remote_dependencies_for_engine';
export { start_new_build_for_engine } from './start_new_build_for_engine';
export { upload_assets_for_engine } from './upload_assets_for_engine';
export { ZephyrEngine } from './zephyr_engine';
export type { BuildProperties } from './zephyr_engine';

// Legacy export for backward compatibility
export const readPackageJson = read_package_json;

// Keep UploadOptions interface for backward compatibility
export interface UploadOptions {
  snapshot: any;
  assets: {
    assetsMap: ZeBuildAssetsMap;
    missingAssets: any[];
  };
  getDashData: (zephyr_engine?: ZephyrEngine) => ZephyrBuildStats;
}
