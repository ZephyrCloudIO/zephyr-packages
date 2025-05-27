import * as isCI from 'is-ci';
import { checkAuth } from '../lib/auth/login';
import type { ZeGitInfo } from '../lib/build-context/ze-util-get-git-info';
import { getGitInfo } from '../lib/build-context/ze-util-get-git-info';
import type { ZePackageJson } from '../lib/build-context/ze-package-json.type';
import { getPackageJson } from '../lib/build-context/ze-util-read-package-json';
import { getApplicationConfiguration } from '../lib/edge-requests/get-application-configuration';
import { ze_log } from '../lib/logging';
import { cyanBright, white, yellow } from '../lib/logging/picocolor';
import type { ZeLogger } from '../lib/logging/ze-log-event';
import type { ZeApplicationConfig } from '../lib/node-persist/upload-provider-options';
import type {
  ZephyrEngineOptions,
  ZephyrEngineBuilderTypes,
} from './defer_create_zephyr_engine';
import { mut_zephyr_app_uid, type ZeApplicationProperties } from './mut_zephyr_app_uid';
import { start_new_build_for_engine } from './start_new_build_for_engine';

export type Platform = 'ios' | 'android' | 'web' | undefined;

export interface CreateZephyrEngineResult {
  npmProperties: ZePackageJson;
  gitProperties: ZeGitInfo;
  application_uid: string;
  application_configuration: Promise<ZeApplicationConfig>;
  applicationProperties: ZeApplicationProperties;
  logger: Promise<ZeLogger>;
  env: {
    isCI: boolean;
    buildEnv: string;
    target: Platform;
  };
  buildProperties: { output: string };
  builder: ZephyrEngineBuilderTypes;
  federated_dependencies: unknown[] | null;
  build_start_time: number | null;
  build_id: Promise<string> | null;
  snapshotId: Promise<string> | null;
  hash_list: Promise<{ hash_set: Set<string> }> | null;
  resolved_hash_list: { hash_set: Set<string> } | null;
  version_url: string | null;
}

export async function create_zephyr_engine(
  options: ZephyrEngineOptions
): Promise<CreateZephyrEngineResult> {
  const context = options.context || process.cwd();

  ze_log(`Initializing: Zephyr Engine for ${context}...`);

  const ze = {
    env: { isCI, buildEnv: isCI ? 'ci' : 'local', target: 'web' as Platform },
    buildProperties: { output: './dist' },
    builder: options.builder,
    federated_dependencies: null,
    build_start_time: null,
    build_id: null,
    snapshotId: null,
    hash_list: null,
    resolved_hash_list: null,
    version_url: null,
  } as Partial<CreateZephyrEngineResult>;

  ze_log('Initializing: npm package info...');
  ze.npmProperties = await getPackageJson(context);

  ze_log('Initializing: git info...');
  ze.gitProperties = await getGitInfo();

  const { applicationProperties, application_uid } = mut_zephyr_app_uid({
    npmProperties: ze.npmProperties!,
    gitProperties: ze.gitProperties!,
  });
  ze.applicationProperties = applicationProperties;
  ze.application_uid = application_uid;

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

  await start_new_build_for_engine(ze as CreateZephyrEngineResult);

  void ze.logger?.then(async (logger) => {
    const appConfig = await ze.application_configuration;
    const buildId = await ze.build_id;

    (logger as (logEntry: unknown) => void)({
      level: 'info',
      action: 'build:info:user',
      ignore: true,
      message: `Hi ${cyanBright(appConfig?.username || 'User')}!\n${white(application_uid)}${yellow(`#${buildId}`)}\n`,
    });
  });

  return ze as CreateZephyrEngineResult;
}
