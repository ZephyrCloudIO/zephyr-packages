import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as isCI from 'is-ci';
import {
  type Snapshot,
  type ZeBuildAsset,
  type ZeBuildAssetsMap,
  ZeUtils,
  type ZephyrBuildStats,
  type ZephyrPluginOptions,
  createApplicationUid,
  flatCreateSnapshotId,
} from 'zephyr-edge-contract';
import { checkAuth } from '../lib/auth/login';
import type { ZePackageJson } from '../lib/build-context/ze-package-json.type';
import { type ZeGitInfo, getGitInfo } from '../lib/build-context/ze-util-get-git-info';
import { getPackageJson } from '../lib/build-context/ze-util-read-package-json';
import { getUploadStrategy } from '../lib/deployment/get-upload-strategy';
import { get_hash_list } from '../lib/edge-hash-list/distributed-hash-control';
import { get_missing_assets } from '../lib/edge-hash-list/get-missing-assets';
import { getApplicationConfiguration } from '../lib/edge-requests/get-application-configuration';
import { getBuildId } from '../lib/edge-requests/get-build-id';
import { ze_log } from '../lib/logging';
import { cyanBright, white, yellow } from '../lib/logging/picocolor';
import { type ZeLogger, logger } from '../lib/logging/ze-log-event';
import { setAppDeployResult } from '../lib/node-persist/app-deploy-result-cache';
import type { ZeApplicationConfig } from '../lib/node-persist/upload-provider-options';
import { createSnapshot } from '../lib/transformers/ze-build-snapshot';
import {
  type ZeResolvedDependency,
  resolve_remote_dependency,
} from './resolve_remote_dependency';
export interface ZeApplicationProperties {
  org: string;
  project: string;
  name: string;
  version: string;
}

export type Platform = 'ios' | 'android' | 'web' | undefined;

export type DeferredZephyrEngine = {
  zephyr_engine_defer: Promise<ZephyrEngine>;
  zephyr_defer_create(options: ZephyrEngineOptions): void;
};

export interface ZeDependencyPair {
  name: string;
  version: string;
}

export interface BuildProperties {
  // output path
  output: string;
  // base href for assets, used to prefix asset paths
  baseHref?: string;
}

export function is_zephyr_dependency_pair(
  dep: ZeDependencyPair | undefined | null
): dep is ZeDependencyPair {
  return !!dep;
}

export function is_zephyr_resolved_dependency(
  dep: ZeResolvedDependency | null
): dep is ZeResolvedDependency {
  return dep !== null;
}

type ZephyrEngineBuilderTypes =
  | 'webpack'
  | 'rspack'
  | 'repack'
  | 'vite'
  | 'rollup'
  | 'parcel'
  | 'unknown';
export interface ZephyrEngineOptions {
  context: string | undefined;
  builder: ZephyrEngineBuilderTypes;
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

  static defer_create(): DeferredZephyrEngine {
    let resolve: (value: ZephyrEngine) => void;
    let reject: (reason?: unknown) => void;

    return {
      zephyr_engine_defer: new Promise<ZephyrEngine>((res, rej) => {
        resolve = res;
        reject = rej;
      }),

      // All zephyr_engine_defer calls are wrapped inside a try/catch,
      // so its safe to reject the promise here and expect it to be handled
      zephyr_defer_create(options: ZephyrEngineOptions) {
        ZephyrEngine.create(options).then(resolve, reject);
      },
    };
  }

  // todo: extract to a separate fn
  static async create(options: ZephyrEngineOptions): Promise<ZephyrEngine> {
    const context = options.context || process.cwd();

    ze_log(`Initializing: Zephyr Engine for ${context}...`);
    const ze = new ZephyrEngine({ context, builder: options.builder });

    ze_log('Initializing: npm package info...');

    ze.npmProperties = await getPackageJson(context);

    ze_log('Initializing: git info...');
    ze.gitProperties = await getGitInfo();
    // mut: set application_uid and applicationProperties
    mut_zephyr_app_uid(ze);
    const application_uid = ze.application_uid;

    // starting async load of application configuration, build_id and hash_list

    ze_log('Initializing: checking authentication...');
    await checkAuth();

    ze_log('Initialized: loading application configuration...');

    ze.application_configuration = getApplicationConfiguration({ application_uid });

    ze.application_configuration
      .then((appConfig) => {
        const { username, email, EDGE_URL } = appConfig;
        ze_log('Loaded: application configuration', { username, email, EDGE_URL });
      })
      .catch((err) => ze_log(`Failed to get application configuration: ${err}`));

    await ze.start_new_build();

    void ze.logger.then(async (logger) => {
      const { username } = await ze.application_configuration;
      const buildId = await ze.build_id;

      logger({
        level: 'info',
        action: 'build:info:user',
        ignore: true,
        message: `Hi ${cyanBright(username)}!\n${white(application_uid)}${yellow(`#${buildId}`)}\n`,
      });
    });

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
    deps: ZeDependencyPair[],
    platform?: ZephyrPluginOptions['target']
  ): Promise<ZeResolvedDependency[] | null> {
    if (!deps) {
      return null;
    }

    ze_log('resolve_remote_dependencies.deps', deps, 'platform', platform);

    const tasks = deps.map(async (dep) => {
      const [app_name, project_name, org_name] = dep.name.split('.', 3);
      // Key might be only the app name
      const dep_application_uid = createApplicationUid({
        org: org_name ?? this.gitProperties.app.org,
        project: project_name ?? this.gitProperties.app.project,
        name: app_name,
      });

      // if default url is url - set as default, if not use app remote_host as default
      // if default url is not url - send it as a semver to deps resolution

      const tuple = await ZeUtils.PromiseTuple(
        resolve_remote_dependency({
          application_uid: dep_application_uid,
          version: dep.version,
          platform,
        })
      );

      // If you couldn't resolve remote dependency, skip replacing it
      if (!ZeUtils.isSuccessTuple(tuple)) {
        ze_log(
          `Failed to resolve remote dependency: ${dep.name}@${dep.version}`,
          'skipping...'
        );
        return null;
      }

      ze_log(`Resolved dependency: ${tuple[1].default_url}`);

      return tuple[1];
    });

    const resolution_results = await Promise.all(tasks);

    this.federated_dependencies = resolution_results.filter(
      is_zephyr_resolved_dependency
    );
    return this.federated_dependencies;
  }

  async start_new_build(): Promise<void> {
    ze_log('Starting new build');
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ze = this;
    ze.build_start_time = Date.now();

    if ((await ze.build_id) && (await ze.snapshotId)) {
      ze_log('Skip: creating new build because no assets was uploaded');
      return;
    }

    const application_uid = ze.application_uid;

    ze_log('Initializing: loading of hash list');
    ze.hash_list = get_hash_list(application_uid);
    ze.hash_list
      .then((hash_set) => {
        ze.resolved_hash_list = hash_set;
        ze_log(`Loaded: hash list with ${hash_set.hash_set.size} entries`);
      })
      .catch((err) => ze_log(`Failed to get hash list: ${err}`));

    ze_log('Initializing: loading of build id');
    ze.build_id = getBuildId(application_uid);
    ze.build_id
      .then((buildId) => ze_log(`Loaded build id "${buildId}"`))
      .catch((err) => ze_log(`Failed to get build id: ${err}`));

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (!ze.logger) {
      ze_log('Initializing: logger');
      let resolve: (value: ZeLogger) => void;
      ze.logger = new Promise<ZeLogger>((r) => (resolve = r));

      // internally logger will try to load app_config
      void Promise.all([ze.application_configuration, ze.build_id]).then((record) => {
        const buildId = record[1];
        ze_log('Initialized: application configuration, build id and hash list');

        resolve(logger({ application_uid, buildId, git: ze.gitProperties.git }));
      });
    }
    // snapshotId is a flat version of application_uid and build_id
    ze.snapshotId = Promise.all([ze.application_configuration, ze.build_id]).then(
      async (record) =>
        flatCreateSnapshotId({
          ...ze.applicationProperties,
          buildId: record[1],
          username: record[0].username,
        })
    );
  }

  async build_finished(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const zephyr_engine = this;
    const logger = await zephyr_engine.logger;
    const zeStart = zephyr_engine.build_start_time;
    const versionUrl = zephyr_engine.version_url;
    const dependencies = zephyr_engine.federated_dependencies;

    const if_target_is_react_native =
      zephyr_engine.env.target === 'ios' || zephyr_engine.env.target === 'android';

    if (zeStart && versionUrl) {
      if (dependencies && dependencies.length > 0) {
        logger({
          level: 'info',
          action: 'build:info:user',
          ignore: true,
          message: if_target_is_react_native
            ? `Resolved zephyr dependencies: ${dependencies.map((dep) => dep.name).join(', ')} for platform: ${zephyr_engine.env.target}`
            : `Resolved zephyr dependencies: ${dependencies.map((dep) => dep.name).join(', ')}`,
        });
      }

      logger({
        level: 'trace',
        action: 'deploy:url',
        message: `Deployed to ${cyanBright('Zephyr')}'s edge in ${yellow(`${Date.now() - zeStart}`)}ms.\n\n${cyanBright(versionUrl)}`,
      });
    }

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
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const zephyr_engine = this;
    ze_log('Initializing: upload assets');
    const { assetsMap, buildStats, mfConfig } = props;

    if (!zephyr_engine.application_uid || !zephyr_engine.build_id) {
      ze_log('Failed to upload assets: missing application_uid or build_id');
      return;
    }

    await zephyr_engine.build_id;
    const hash_set = zephyr_engine.resolved_hash_list;

    const missingAssets = get_missing_assets({
      assetsMap,
      hash_set: hash_set ?? { hash_set: new Set() },
    });

    // upload data
    const snapshot = await createSnapshot(zephyr_engine, {
      assets: assetsMap,
      mfConfig,
    });

    const upload_options: UploadOptions = {
      snapshot,
      getDashData: () => buildStats,
      assets: {
        assetsMap,
        missingAssets,
      },
    };

    // upload
    const platform = (await zephyr_engine.application_configuration).PLATFORM;
    const strategy = getUploadStrategy(platform);
    zephyr_engine.version_url = await strategy(zephyr_engine, upload_options);

    if (isCI) {
      const application_uid = zephyr_engine.application_uid;
      await setAppDeployResult(application_uid, { urls: [zephyr_engine.version_url] });
    }

    await this.build_finished();
  }
}

function mut_zephyr_app_uid(ze: ZephyrEngine): void {
  ze.applicationProperties = {
    org: ze.gitProperties.app.org,
    project: ze.gitProperties.app.project,
    name: ze.npmProperties.name,
    version: ze.npmProperties.version,
  };
  ze.application_uid = createApplicationUid(ze.applicationProperties);
}

export interface UploadOptions {
  snapshot: Snapshot;
  assets: {
    assetsMap: ZeBuildAssetsMap;
    missingAssets: ZeBuildAsset[];
  };
  getDashData: (zephyr_engine?: ZephyrEngine) => ZephyrBuildStats;
}

export interface ZephyrDependencies {
  [key: string]: string;
}

export function readPackageJson(root: string): {
  zephyrDependencies: ZephyrDependencies;
} {
  const packageJsonPath = join(root, 'package.json');
  const packageJsonContent = existsSync(packageJsonPath)
    ? readFileSync(packageJsonPath, 'utf-8')
    : '{}';
  return JSON.parse(packageJsonContent);
}
