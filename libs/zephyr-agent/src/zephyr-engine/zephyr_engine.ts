import * as isCI from 'is-ci';
import type {
  ZeBuildAssetsMap,
  ZephyrBuildStats,
  ZephyrPluginOptions,
} from 'zephyr-edge-contract';
import type { ZePackageJson } from '../lib/build-context/ze-package-json.type';
import type { ZeGitInfo } from '../lib/build-context/ze-util-get-git-info';
import type { ZeLogger } from '../lib/logging/ze-log-event';
import type { ZeApplicationConfig } from '../lib/node-persist/upload-provider-options';
import type { ZeResolvedDependency } from './resolve_remote_dependency';

// Import extracted functions
import { build_finished_for_engine } from './build_finished_for_engine';
import {
  create_zephyr_engine,
  type CreateZephyrEngineResult,
  type Platform,
} from './create_zephyr_engine';
import {
  defer_create_zephyr_engine,
  type DeferredZephyrEngine,
  type ZephyrEngineBuilderTypes,
  type ZephyrEngineOptions,
} from './defer_create_zephyr_engine';
import { type ZeDependencyPair } from './is_zephyr_dependency_pair';
import { type ZeApplicationProperties } from './mut_zephyr_app_uid';
import { resolve_remote_dependencies_for_engine } from './resolve_remote_dependencies_for_engine';
import { start_new_build_for_engine } from './start_new_build_for_engine';
import { upload_assets_for_engine } from './upload_assets_for_engine';

export interface BuildProperties {
  // output path
  output: string;
}

/**
 * IMPORTANT: do NOT add methods to this class, keep it lean! IMPORTANT: use `await
 * ZephyrEngine.create(context)` to create an instance ZephyrEngine instance represents
 * current state of a build if there are methods - they should call pure functions from
 * ./internal
 */
export class ZephyrEngine {
  // npm and git properties initialized in `create` method
  npmProperties!: ZePackageJson;
  gitProperties!: ZeGitInfo;
  // generated in the `create` constructor
  application_uid!: string;

  // load once properties
  application_configuration!: Promise<ZeApplicationConfig>;
  applicationProperties!: ZeApplicationProperties;
  logger!: Promise<ZeLogger>;

  // build context properties
  env: {
    isCI: boolean;
    buildEnv: string;
    target: Platform;
  } = { isCI, buildEnv: isCI ? 'ci' : 'local', target: 'web' };
  buildProperties: BuildProperties = { output: './dist' };
  builder: ZephyrEngineBuilderTypes;

  // resolved dependencies
  federated_dependencies: ZeResolvedDependency[] | null = null;
  // build hook properties
  build_start_time: number | null = null;
  build_id: Promise<string> | null = null;
  snapshotId: Promise<string> | null = null;
  hash_list: Promise<{ hash_set: Set<string> }> | null = null;
  resolved_hash_list: { hash_set: Set<string> } | null = null;
  version_url: string | null = null;

  /** This is intentionally PRIVATE use `await ZephyrEngine.create(context)` */
  private constructor(options: ZephyrEngineOptions) {
    this.builder = options.builder;
  }

  static defer_create(): DeferredZephyrEngine<ZephyrEngine> {
    return defer_create_zephyr_engine(ZephyrEngine);
  }

  static async create(options: ZephyrEngineOptions): Promise<ZephyrEngine> {
    const result = await create_zephyr_engine(options);
    const ze = new ZephyrEngine(options);

    // Copy all properties from the result to the ZephyrEngine instance
    Object.assign(ze, result);

    return ze;
  }

  /**
   * Accept two argument to resolve remote dependencies:
   *
   * @param dependencyPair, Includes name and versions (the url includes localhost),
   * @param platform, Atm this is React Native specific to resolve correct platform `ios`
   *   or `android`
   */
  async resolve_remote_dependencies(
    deps: ZeDependencyPair[]
  ): Promise<ZeResolvedDependency[] | null> {
    const result = await resolve_remote_dependencies_for_engine(deps, {
      npmProperties: this.npmProperties,
      env: this.env,
      gitProperties: this.gitProperties,
    });

    this.federated_dependencies = result;
    return result;
  }

  async start_new_build(): Promise<void> {
    await start_new_build_for_engine(this as CreateZephyrEngineResult);
  }

  async build_finished(): Promise<void> {
    await build_finished_for_engine({
      logger: this.logger,
      build_start_time: this.build_start_time,
      version_url: this.version_url,
      federated_dependencies: this.federated_dependencies,
      env: this.env,
    });

    // Reset state
    this.build_id = null;
    this.snapshotId = null;
    this.version_url = null;
    this.build_start_time = null;
  }

  async upload_assets(props: {
    assetsMap: ZeBuildAssetsMap;
    buildStats: ZephyrBuildStats;
    mfConfig?: Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig'];
  }): Promise<void> {
    const version_url = await upload_assets_for_engine(props, {
      application_uid: this.application_uid,
      build_id: this.build_id,
      resolved_hash_list: this.resolved_hash_list,
      application_configuration: this.application_configuration,
      version_url: this.version_url,
      logger: this.logger,
      build_start_time: this.build_start_time,
      federated_dependencies: this.federated_dependencies,
      env: this.env,
      gitProperties: this.gitProperties,
      applicationProperties: this.applicationProperties,
    });

    if (version_url) {
      this.version_url = version_url;
    }
  }
}
