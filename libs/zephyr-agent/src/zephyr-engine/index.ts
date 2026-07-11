import isCI from 'is-ci';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ZephyrDependency } from 'zephyr-edge-contract';
import {
  type Snapshot,
  ZEPHYR_MANIFEST_FILENAME,
  ZE_ENV,
  type ZeBuildAsset,
  type ZeBuildAssetsMap,
  type ZephyrBuildTarget,
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
import {
  getZephyrConfig,
  mergeRemoteDependencies,
  type ResolvedZephyrConfig,
} from '../lib/build-context/zephyr-config';
import { getUploadStrategy } from '../lib/deployment/get-upload-strategy';
import { get_hash_list } from '../lib/edge-hash-list/distributed-hash-control';
import { get_missing_assets } from '../lib/edge-hash-list/get-missing-assets';
import { getApplicationConfiguration } from '../lib/edge-requests/get-application-configuration';
import { getBuildId } from '../lib/edge-requests/get-build-id';
import { ZeErrors, ZephyrError } from '../lib/errors';
import { ze_log } from '../lib/logging';
import { cyanBright, greenBright, white, yellow } from '../lib/logging/picocolor';
import { type ZeLogger, logFn, logger } from '../lib/logging/ze-log-event';
import { setAppDeployResult } from '../lib/node-persist/app-deploy-result-cache';
import type { ZeApplicationConfig } from '../lib/node-persist/upload-provider-options';
import { zeBuildAssets } from '../lib/transformers/ze-build-assets';
import { createSnapshot } from '../lib/transformers/ze-build-snapshot';
import {
  convertResolvedDependencies,
  createManifestContent,
} from '../lib/transformers/ze-create-manifest';
import { maybeShowOutdatedPluginWarning } from '../lib/version/outdated-plugin-warning';
import { resolveZephyrPluginPackageName } from '../lib/version/plugin-package-name';
import { getZephyrAgentVersion } from '../lib/version/zephyr-agent-version';
import { warnPathModeAbsoluteUrls } from '../lib/utils/warn-path-mode-absolute-urls';
import {
  type ZeResolvedDependency,
  resolve_remote_dependency,
} from './resolve_remote_dependency';
import type {
  ZephyrEngineBuilderTypes,
  ZephyrEngineOptions,
} from './zephyr-engine.types';

export { ApplicationContext, ApplicationContextRegistry } from './application-context';
export {
  BuildParticipantFailedError,
  BuildSession,
  BuildSessionAbortedError,
  BuildSessionAssetCollisionError,
  BuildSessionNotReadyError,
  BuildSessionRollbackError,
  BuildSessionStateError,
} from './build-session';
export type {
  ApplicationContextOptions,
  ApplicationContextRegistryLocator,
  BeginBuildOptions,
  BuildContribution,
  BuildParticipant,
  BuildParticipantRole,
  BuildSessionIdentity,
  BuildSessionFailureCallback,
  BuildSessionLifecycleCallback,
  BuildSessionPublication,
  BuildSessionReadiness,
  BuildSessionStatus,
  PublishedBuildContribution,
  ZephyrEngineBuilderTypes,
  ZephyrEngineOptions,
} from './zephyr-engine.types';
export interface ZeApplicationProperties {
  org: string;
  project: string;
  name: string;
  version: string;
}

/** @deprecated Prefer `ZephyrBuildTarget` from `zephyr-edge-contract`. */
export type Platform = ZephyrBuildTarget | undefined;

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

export interface ZeUser {
  username: string;
  email: string;
  user_uuid: string;
  jwt: string;
}

export interface ZephyrBuildHooks {
  onDeployComplete?: (deploymentInfo: DeploymentInfo) => void | Promise<void>;
}

export interface DeploymentInfo {
  url: string;
  snapshotId: string | null;
  snapshot: Snapshot;
  federatedDependencies: ZeResolvedDependency[];
  buildStats: ZephyrBuildStats;
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
  zephyrConfig!: ResolvedZephyrConfig;
  // generated in the `create` constructor
  application_uid!: string;

  // load once properties
  application_configuration!: Promise<ZeApplicationConfig>;
  applicationProperties!: ZeApplicationProperties;
  logger!: Promise<ZeLogger>;

  // build context properties
  env: {
    isCI: boolean;
    target: Platform;
    env?: string | undefined;
    ssr?: boolean;
  } = { isCI, target: 'web', env: ZE_ENV(), ssr: false };
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
  // set when waitForDeployments is true and build stats are uploaded
  target_urls: string[] | null = null;
  // time it took to finish uploading build stats
  build_stats_time: number | null = null;
  // Store snapshot with env vars for use in buildStats
  snapshot_with_envs: Snapshot | null = null;
  // Store env vars temporarily for API to use (not in snapshot)
  ze_env_vars: Record<string, string> | null = null;
  // Store env vars hash for API to use
  ze_env_vars_hash: string | null = null;
  // Version of worker engine that processed snapshot upload
  worker_version: string | null = null;

  /** Whether this engine still owns state that must be finished or rolled back. */
  get hasActiveBuild(): boolean {
    return (
      this.build_start_time !== null || this.build_id !== null || this.snapshotId !== null
    );
  }

  get zephyr_dependencies(): Record<string, ZephyrDependency> {
    return convertResolvedDependencies(this.federated_dependencies ?? []);
  }

  /** This is intentionally PRIVATE use `await ZephyrEngine.create(context)` */
  private constructor(options: ZephyrEngineOptions) {
    this.builder = options.builder;
  }

  static defer_create(): DeferredZephyrEngine {
    let resolve: (value: ZephyrEngine) => void;
    let reject: (reason?: unknown) => void;
    let creationStarted = false;

    const zephyr_engine_defer = new Promise<ZephyrEngine>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    // Engine initialization starts in an early bundler hook, while the first await often
    // happens in a much later output hook. Mark the promise handled immediately so a fast
    // initialization failure cannot become an unhandledRejection in between. Awaiting the
    // original promise still observes the same rejection.
    void zephyr_engine_defer.catch(() => undefined);

    return {
      zephyr_engine_defer,

      zephyr_defer_create(options: ZephyrEngineOptions) {
        // Reusable plugin instances can receive buildStart/config hooks for every watch
        // generation. They must reuse the resolved engine, not allocate abandoned engines.
        if (creationStarted) return;
        creationStarted = true;
        void ZephyrEngine.create(options).then(resolve, reject);
      },
    };
  }

  // todo: extract to a separate fn
  static async create(options: ZephyrEngineOptions): Promise<ZephyrEngine> {
    const context = options.context || process.cwd();
    const zephyrConfig = getZephyrConfig(context);

    ze_log.init(`Initializing: Zephyr Engine for ${context}...`);
    const ze = new ZephyrEngine({ context, builder: options.builder });
    ze.zephyrConfig = zephyrConfig;

    ze_log.init('Initializing: npm package info...');

    ze.npmProperties = await getPackageJson(context, zephyrConfig);
    const pluginPackageName = resolveZephyrPluginPackageName(
      ze.npmProperties,
      options.builder
    );
    void maybeShowOutdatedPluginWarning(pluginPackageName);

    ze_log.init('Initializing: git info...');
    ze.gitProperties = await getGitInfo(context, zephyrConfig);
    // mut: set application_uid and applicationProperties
    mut_zephyr_app_uid(ze);
    const application_uid = ze.application_uid;

    // starting async load of application configuration, build_id and hash_list

    ze_log.init('Initializing: checking authentication...');
    await checkAuth(ze.gitProperties);

    ze_log.init('Initialized: loading application configuration...');

    ze.application_configuration = getApplicationConfiguration({ application_uid });

    ze.application_configuration
      .then((appConfig) => {
        const { username, email, EDGE_URL } = appConfig;
        ze_log.init('Loaded: application configuration', { username, email, EDGE_URL });
      })
      .catch((err) => ze_log.init(`Failed to get application configuration: ${err}`));

    try {
      await ze.start_new_build();
      const [initializedLogger, { username }, buildId] = await Promise.all([
        ze.logger,
        ze.application_configuration,
        ze.build_id,
      ]);
      initializedLogger({
        level: 'info',
        action: 'build:info:user',
        ignore: true,
        message: `Hi ${cyanBright(username)}!\n${white(application_uid)}${yellow(
          `#${buildId}`
        )}\n`,
      });

      return ze;
    } catch (error: unknown) {
      // start_new_build completed, so any later initialization/logging failure owns an
      // active build identity that must not escape through a rejected create() call.
      if (ze.hasActiveBuild) {
        ze.build_failed();
      }
      throw error;
    }
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
    defaultLibraryType = 'var'
  ): Promise<ZeResolvedDependency[] | null> {
    if (!deps) {
      return null;
    }

    const app_config = await this.application_configuration;
    const ze_dependencies = this.npmProperties.zephyrDependencies;
    const platform = this.env.target;
    const build_context_json = {
      target: this.env.target,
      isCI,
      branch: this.gitProperties.git.branch,
      username: app_config.username,
      env: this.env.env,
    };
    if (this.env.env) {
      ze_log.config('Using environment:', this.env.env);
    }
    // convert to base64
    const build_context = Buffer.from(JSON.stringify(build_context_json)).toString(
      'base64'
    );

    ze_log.remotes(
      'resolve_remote_dependencies.deps',
      deps,
      'platform',
      platform,
      'ze_dependencies',
      ze_dependencies
    );

    const resolution_errors: Array<{ dep: ZeDependencyPair; error: unknown }> = [];

    const tasks = deps.map(async (dep) => {
      const [app_name, project_name, org_name] = dep.name.split('.', 3);
      const ze_dependency = ze_dependencies?.[dep.name];
      const [ze_app_name, ze_project_name, ze_org_name] =
        ze_dependency?.app_uid?.split('.') ?? [];
      // Key might be only the app name
      const dep_application_uid = createApplicationUid({
        org: ze_org_name ?? org_name ?? this.gitProperties.app.org,
        project: ze_project_name ?? project_name ?? this.gitProperties.app.project,
        name: ze_app_name ?? app_name,
      });

      // if default url is url - set as default, if not use app remote_host as default
      // if default url is not url - send it as a semver to deps resolution

      const tuple = await ZeUtils.PromiseTuple(
        resolve_remote_dependency({
          application_uid: dep_application_uid,
          version: ze_dependency?.version ?? dep.version,
          platform,
          build_context,
        })
      );

      // If you couldn't resolve remote dependency, skip replacing it
      if (!ZeUtils.isSuccessTuple(tuple)) {
        ze_log.remotes(
          `Failed to resolve remote dependency: ${dep.name}@${dep.version}`,
          'skipping...'
        );
        resolution_errors.push({ dep, error: tuple[0] });
        return null;
      }

      ze_log.remotes(`Resolved dependency: ${tuple[1].default_url}`);

      if (dep.name === tuple[1].name) {
        return tuple[1];
      }

      return Object.assign({ library_type: defaultLibraryType }, tuple[1], {
        name: dep.name,
        version: dep.version,
      });
    });

    const resolution_results = await Promise.all(tasks);

    // If there are resolution errors, log it with summary
    if (resolution_errors.length > 0) {
      const logger = await this.logger;
      const errorSummary = resolution_errors
        .map(({ dep, error }) => {
          const errorMessage = ZephyrError.is(error)
            ? `Error code: ${error.code}`
            : `Unknown error`;
          const version =
            ZephyrError.is(error) && error.template && 'version' in error.template
              ? (error.template.version as string)
              : dep.version;
          return `  - ${dep.name}@${version} -> ${errorMessage}`;
        })
        .join('\n');

      logger({
        level: 'warn',
        action: 'build:error:dependency_resolution',
        message: `Failed to resolve remote dependencies:
${errorSummary}\n
More information on remote dependency resolution please check:
https://docs.zephyr-cloud.io/features/remote-dependencies`,
      });
    }

    this.federated_dependencies = resolution_results.filter(
      is_zephyr_resolved_dependency
    );

    // Log resolved remotes for build visibility
    if (this.federated_dependencies.length > 0) {
      const remotesList = this.federated_dependencies
        .map((dep) => `  ${dep.name} → ${dep.remote_entry_url}`)
        .join('\n');
      logFn('info', `Resolved remotes:\n${remotesList}`);
    }

    return this.federated_dependencies;
  }

  async start_new_build(): Promise<void> {
    ze_log.init('Starting new build');
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ze = this;
    ze.build_start_time = Date.now();

    if (ze.build_id && ze.snapshotId && (await ze.build_id) && (await ze.snapshotId)) {
      ze_log.init('Skip: creating new build because no assets was uploaded');
      return;
    }

    const application_uid = ze.application_uid;

    ze_log.init('Initializing: loading of hash list');
    const hashList = get_hash_list(application_uid);
    ze.hash_list = hashList;
    hashList
      .then((hash_set) => {
        // A failed generation may be reset while this optimization is still in flight.
        // Never let its late result contaminate a newer generation.
        if (ze.hash_list === hashList) {
          ze.resolved_hash_list = hash_set;
          ze_log.app(`Loaded: hash list with ${hash_set.hash_set.size} entries`);
        }
      })
      .catch((err) => ze_log.app(`Failed to get hash list: ${err}`));

    ze_log.init('Initializing: loading of build id');
    const buildId = getBuildId(application_uid);
    ze.build_id = buildId;
    buildId
      .then((buildId) => ze_log.app(`Loaded build id "${buildId}"`))
      .catch((err) => ze_log.app(`Failed to get build id: ${err}`));

    // The logger carries a build ID and must therefore be recreated per generation.
    // Chaining it directly to its prerequisites propagates rejection to every waiter;
    // a resolve-only deferred promise would remain pending forever on either failure.
    ze_log.init('Initializing: logger');
    const initializedLogger = Promise.all([ze.application_configuration, buildId]).then(
      (record) => {
        const resolvedBuildId = record[1];
        ze_log.init('Initialized: application configuration, build id and hash list');

        return logger({
          application_uid,
          buildId: resolvedBuildId,
          git: ze.gitProperties.git,
        });
      }
    );
    ze.logger = initializedLogger;

    // snapshotId is a flat version of application_uid and build_id
    const snapshotId = Promise.all([ze.application_configuration, buildId]).then(
      (record) =>
        flatCreateSnapshotId({
          ...ze.applicationProperties,
          buildId: record[1],
          username: record[0].username,
        })
    );
    ze.snapshotId = snapshotId;

    try {
      // Build identity is required state, unlike the best-effort hash-list cache. Do not
      // report a usable engine/generation until all identity-dependent awaiters settle.
      await Promise.all([initializedLogger, snapshotId]);
    } catch (error: unknown) {
      if (ze.build_id === buildId) {
        resetBuildState(ze);
      }
      throw error;
    }
  }

  async build_finished(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const zephyr_engine = this;
    try {
      const logger = await zephyr_engine.logger;
      const zeStart = zephyr_engine.build_start_time;
      const buildStatsTime = zephyr_engine.build_stats_time;
      const versionUrl = zephyr_engine.version_url;
      const targetUrls = zephyr_engine.target_urls;
      const dependencies = zephyr_engine.federated_dependencies;

      const if_target_is_react_native =
        zephyr_engine.env.target === 'ios' || zephyr_engine.env.target === 'android';

      const ze_env = ZE_ENV();
      if (ze_env) {
        logger({
          level: 'info',
          action: 'build:info:env',
          ignore: true,
          message: `Using environment: ${cyanBright(ze_env)}`,
        });
        zephyr_engine.env.env = ze_env;
      }

      if (zeStart && versionUrl) {
        if (dependencies && dependencies.length > 0) {
          logger({
            level: 'info',
            action: 'build:info:user',
            ignore: true,
            message: if_target_is_react_native
              ? `Resolved zephyr dependencies: ${dependencies
                  .map((dep) => dep.name)
                  .join(', ')} for platform: ${zephyr_engine.env.target}`
              : `Resolved zephyr dependencies: ${dependencies
                  .map((dep) => dep.name)
                  .join(', ')}`,
          });
        }

        logger({
          level: 'trace',
          action: 'deploy:url',
          message: `Deployed to ${cyanBright('Zephyr')}'s edge in ${yellow(
            `${Date.now() - zeStart}`
          )}ms.\n\n${cyanBright(versionUrl)}`,
        });
      }

      if (targetUrls?.length && buildStatsTime) {
        logger({
          level: 'trace',
          action: 'deploy:url',
          message: `\nUpdated ${greenBright(targetUrls.length.toString())} targets in ${yellow(buildStatsTime?.toString())}ms\n- ${targetUrls.join('\n- ')}`,
        });
      }
    } finally {
      resetBuildState(this);
    }
  }

  /** Discard every value owned by a failed/aborted logical build generation. */
  build_failed(): void {
    resetBuildState(this);
  }

  /**
   * Upload one sealed logical build. This method does not finish or reset the build;
   * callers must invoke build_finished explicitly (normally as
   * ApplicationContext.finish).
   */
  async upload_assets(props: {
    assetsMap: ZeBuildAssetsMap;
    buildStats: ZephyrBuildStats;
    mfConfig?: Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig'];
    // SSR-specific parameter
    snapshotType?: 'csr' | 'ssr';
    entrypoint?: string;
    hooks?: ZephyrBuildHooks;
  }): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const zephyr_engine = this;
    try {
      ze_log.upload('Initializing: upload assets');
      const {
        assetsMap: providedAssetsMap,
        buildStats,
        mfConfig,
        snapshotType,
        entrypoint,
      } = props;
      // BuildSession publications are immutable. Preserve the legacy mutation behavior for
      // direct adapter maps while accepting sealed maps without throwing.
      const assetsMap = Object.isFrozen(providedAssetsMap)
        ? { ...providedAssetsMap }
        : providedAssetsMap;

      await warnPathModeAbsoluteUrls(zephyr_engine, assetsMap);

      const manifest = {
        filepath: ZEPHYR_MANIFEST_FILENAME,
        content: createManifestContent(zephyr_engine.federated_dependencies ?? []),
      };
      const manifestAsset = zeBuildAssets(manifest);
      assetsMap[manifestAsset.hash] = manifestAsset;

      if (!zephyr_engine.application_uid || !zephyr_engine.build_id) {
        throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
          message:
            'ZephyrEngine cannot upload before application_uid and build_id are initialized.',
        });
      }

      await zephyr_engine.build_id;
      let hash_set = zephyr_engine.resolved_hash_list;
      if (!hash_set && zephyr_engine.hash_list) {
        try {
          hash_set = await zephyr_engine.hash_list;
          zephyr_engine.resolved_hash_list = hash_set;
        } catch (error) {
          // Hash-list lookup is an optimization. A transient cache/API failure must not
          // publish against an incomplete set; upload every asset instead.
          ze_log.upload(`Failed to load hash list; uploading all assets: ${error}`);
          hash_set = { hash_set: new Set() };
        }
      }

      const missingAssets = get_missing_assets({
        assetsMap,
        hash_set: hash_set ?? { hash_set: new Set() },
      });

      // upload data
      const snapshot = await createSnapshot(zephyr_engine, {
        assets: assetsMap,
        mfConfig,
        snapshotType,
        entrypoint,
      });

      const waitForCompletion = !!process.env['ZE_WAIT_FOR_DEPLOYMENTS']?.trim();

      if (waitForCompletion) {
        const logger = await this.logger;

        logger({
          action: 'deploy:wait',
          level: 'info',
          message: `Waiting for deployment to complete...`,
        });
      }

      const upload_options: UploadOptions = {
        snapshot,
        getDashData: (engine) => {
          const dash_data =
            buildStats.ze_envs || buildStats.ze_envs_hash
              ? buildStats
              : {
                  ...buildStats,
                  ze_envs: (engine || zephyr_engine).ze_env_vars || undefined,
                  ze_envs_hash: (engine || zephyr_engine).ze_env_vars_hash || undefined,
                };

          return {
            ...dash_data,
            builder: dash_data.builder ?? zephyr_engine.builder,
            plugin_version: dash_data.plugin_version ?? getZephyrAgentVersion(),
            worker_version:
              dash_data.worker_version ?? zephyr_engine.worker_version ?? undefined,
            waitForCompletion,
          };
        },
        assets: {
          assetsMap,
          missingAssets,
        },
      };

      // upload
      const platform = (await zephyr_engine.application_configuration).PLATFORM;
      const strategy = getUploadStrategy(platform);
      zephyr_engine.version_url = await strategy(zephyr_engine, upload_options);

      const application_uid = zephyr_engine.application_uid;
      await setAppDeployResult(application_uid, {
        urls: [zephyr_engine.version_url],
        snapshot,
      });

      // Call deployment hook if provided
      if (props.hooks?.onDeployComplete && zephyr_engine.version_url) {
        try {
          const snapshotId = await zephyr_engine.snapshotId;
          const deploymentInfo: DeploymentInfo = {
            url: zephyr_engine.version_url,
            snapshotId,
            snapshot,
            federatedDependencies: zephyr_engine.federated_dependencies || [],
            buildStats: upload_options.getDashData(zephyr_engine),
          };

          await props.hooks.onDeployComplete(deploymentInfo);
        } catch (error: unknown) {
          // Log hook errors but don't fail the build
          ze_log.upload('Warning: deployment hook failed', error);
        }
      }
    } catch (error: unknown) {
      zephyr_engine.build_failed();
      throw error;
    }
  }
}

function resetBuildState(zephyr_engine: ZephyrEngine): void {
  zephyr_engine.build_id = null;
  zephyr_engine.snapshotId = null;
  zephyr_engine.hash_list = null;
  zephyr_engine.resolved_hash_list = null;
  zephyr_engine.version_url = null;
  zephyr_engine.target_urls = null;
  zephyr_engine.build_start_time = null;
  zephyr_engine.build_stats_time = null;
  zephyr_engine.snapshot_with_envs = null;
  zephyr_engine.ze_env_vars = null;
  zephyr_engine.ze_env_vars_hash = null;
  zephyr_engine.worker_version = null;
}

function mut_zephyr_app_uid(ze: ZephyrEngine): void {
  ze.applicationProperties = {
    org: ze.gitProperties.app.org,
    project: ze.gitProperties.app.project,
    name: ze.zephyrConfig.appName ?? ze.npmProperties.name,
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

export function readPackageJson(
  root: string,
  zephyrConfig: ResolvedZephyrConfig = getZephyrConfig(root)
): {
  zephyrDependencies?: ZephyrDependencies;
} {
  const packageJsonPath = join(root, 'package.json');
  const packageJsonContent = existsSync(packageJsonPath)
    ? readFileSync(packageJsonPath, 'utf-8')
    : '{}';
  const packageJson = JSON.parse(packageJsonContent) as {
    zephyrDependencies?: ZephyrDependencies;
    ['zephyr:dependencies']?: ZephyrDependencies;
  };
  const zephyrDependencies = mergeRemoteDependencies(
    packageJson.zephyrDependencies ?? packageJson['zephyr:dependencies'],
    zephyrConfig
  );

  return zephyrDependencies ? { ...packageJson, zephyrDependencies } : packageJson;
}
