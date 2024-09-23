import * as isCI from 'is-ci';
import type { OutputAsset, OutputBundle, OutputChunk } from 'rollup';
import type { Plugin, ResolvedConfig } from 'vite';
import {
  buildAssetsMap,
  checkAuth,
  getApplicationConfiguration,
  getBuildId,
  getGitInfo,
  getPackageJson,
  get_hash_list,
  get_missing_assets,
  logger,
  upload,
  zeGetDashData,
} from 'zephyr-agent';
import {
  type ZephyrPluginOptions,
  createApplicationUID,
  cyanBright,
  getPartialAssetMap,
  removePartialAssetMap,
  white,
  yellow,
  ze_error,
  ze_log,
} from 'zephyr-edge-contract';
import { load_public_dir } from './load_public_dir';
import { load_static_entries } from './load_static_entries';
import type { ZephyrInternalOptions } from './types/zephyr-internal-options';
import { parseRemoteMap, replaceProtocolAndHost } from './remote_map_parser';
import { resolve_remote_dependency } from './resolve_remote_dependency';
import federation, { VitePluginFederationOptions } from '@originjs/vite-plugin-federation';

interface ZephyrPartialInternalOptions {
  root: string;
  configFile: string;
  outDir: string;
  publicDir?: string;
}

export function withZephyr(_options?: VitePluginFederationOptions): Plugin {
  return zephyrPlugin(_options);
}

function zephyrPlugin(_options?: VitePluginFederationOptions): Plugin {
  let gitInfo: Awaited<ReturnType<typeof getGitInfo>>;
  let packageJson: Awaited<ReturnType<typeof getPackageJson>>;
  let application_uid: string;

  const vite_internal_options = {} as ZephyrPartialInternalOptions;

  return {
    name: 'with-zephyr',
    enforce: 'post',

    config: (config) => {
      config.plugins = config.plugins || [];

      // only push the options when options are presented
      _options &&
        config.plugins.push(
          federation({
            ..._options,
          })
        );
    },

    configResolved: async (config: ResolvedConfig) => {
      Object.assign(vite_internal_options, {
        root: config.root,
        configFile: config.configFile,
        outDir: config.build.outDir,
        publicDir: config.publicDir,
      });

      ze_log('Configuring with Zephyr...');
      packageJson = await getPackageJson(vite_internal_options.root);
      ze_log('Loaded package.json.', packageJson);
      if (!packageJson) return ze_error('ERR_PACKAGE_JSON_NOT_FOUND');

      gitInfo = await getGitInfo();
      ze_log('Loaded Git Info.', gitInfo);
      if (!gitInfo || !gitInfo?.app.org || !gitInfo?.app.project)
        return ze_error(
          'ERR_NO_GIT_INFO',
          'Could not get git info. \n Can you confirm this directory has initialized as a git repository? '
        );
      if (!packageJson?.name) return ze_error('ERR_PACKAGE_JSON_MUST_HAVE_NAME_VERSION');

      application_uid = createApplicationUID({
        org: gitInfo.app.org,
        project: gitInfo.app.project,
        name: packageJson?.name,
      });

      ze_log('vite-zephyr-options', vite_internal_options);
    },
    // Used by Vite dev server for in memory bundles
    transform: async (code: string) => {
      // If there is no options getting passed in return undefined and pass the code directly to next step
      const extractedRemoteMap = _options ? await parseRemoteMap(code) : undefined;

      if (extractedRemoteMap === undefined) {
        return code;
      }

      const { remotesMap, startIndex, endIndex } = extractedRemoteMap;

      for (const [remoteName, remoteConfig] of Object.entries(remotesMap)) {
        const remote_application_uuid = createApplicationUID({
          org: gitInfo.app.org,
          project: gitInfo.app.project,
          name: remoteName,
        });
        ze_log('Resolving remote:', remote_application_uuid, remoteName);
        const remoteDetails = await resolve_remote_dependency({ name: remote_application_uuid, version: '*' });
        ze_log('Resolved remote:', remoteDetails);

        if (!remoteDetails) {
          continue;
        }

        ze_log('Updating remote url:', remoteConfig.url, remoteDetails.remote_entry_url);
        remoteConfig.url = replaceProtocolAndHost(remoteConfig.url, remoteDetails.remote_entry_url);
        ze_log('Updated remote url:', remoteConfig.url);
      }

      ze_log('Writing remotesMap to bundle:', remotesMap);

      const newObjectCode = `const remotesMap = ${JSON.stringify(remotesMap)};`;

      return code.slice(0, startIndex) + newObjectCode + code.slice(endIndex);
    },
    closeBundle: async () => {
      const publicAssets: OutputAsset[] = [];

      if (vite_internal_options.publicDir) {
        const _public_assets = await load_public_dir({
          outDir: vite_internal_options.outDir,
          publicDir: vite_internal_options.publicDir,
        });
        publicAssets.push(..._public_assets);
      }

      const _static_assets = await load_static_entries({
        root: vite_internal_options.root,
        outDir: vite_internal_options.outDir,
      });
      publicAssets.push(..._static_assets);

      const assets = Object.assign({}, ...publicAssets.map((asset) => ({ [asset.fileName]: asset })));

      await _zephyr({ assets, vite_internal_options, application_uid, packageJson, gitInfo });
    },
  };
}

type ZephyrOptions = {
  assets: OutputBundle;
  vite_internal_options: ZephyrInternalOptions;
  application_uid: string;
  gitInfo: Awaited<ReturnType<typeof getGitInfo>>;
  packageJson: Awaited<ReturnType<typeof getPackageJson>>;
};

async function _zephyr(options: ZephyrOptions) {
  const { assets: _assets, vite_internal_options, application_uid, packageJson, gitInfo } = options;

  ze_log('Going to check auth token or get it...');
  await checkAuth();

  ze_log('Got auth token, going to get application configuration and build id...');
  const [appConfig, buildId, hash_set] = await Promise.all([
    getApplicationConfiguration({ application_uid }),
    getBuildId(application_uid),
    get_hash_list(application_uid),
  ]);
  const { username, email, EDGE_URL } = appConfig;

  ze_log('Got application configuration', { username, email, EDGE_URL });

  if (!buildId) return ze_error('ERR_GET_BUILD_ID');

  const pluginOptions: ZephyrPluginOptions = {
    pluginName: 'vite-plugin-zephyr',
    application_uid,
    buildEnv: 'local',
    username,
    app: {
      name: packageJson.name,
      version: packageJson.version,
      org: gitInfo.app.org,
      project: gitInfo.app.project,
    },
    git: gitInfo?.git,
    isCI,
    zeConfig: {
      user: username,
      edge_url: EDGE_URL,
      buildId,
    },
    mfConfig: void 0,
  };

  ze_log('\nzephyr agent started.\n');
  const logEvent = logger(pluginOptions);

  logEvent({
    level: 'info',
    action: 'build:info:user',
    ignore: true,
    message: `Hi ${cyanBright(username)}!\n${white(application_uid)}${yellow(`#${buildId}`)}\n`,
  });

  const zeStart = Date.now();

  const partialAssetMap = await getPartialAssetMap(application_uid);
  await removePartialAssetMap(application_uid);

  const assets = Object.assign({}, _assets, ...Object.values(partialAssetMap ?? {}));

  const assetsMap = buildAssetsMap(assets, extractBuffer, getAssetType);
  const missingAssets = get_missing_assets({ assetsMap, hash_set });

  await upload({
    pluginOptions,
    assets: {
      assetsMap,
      missingAssets,
      outputPath: vite_internal_options.outDir,
      count: Object.keys(assets).length,
    },
    // @ts-expect-error TODO: fix this types to get legacy and current working
    getDashData: zeGetDashData,
    appConfig,
    zeStart,
  });
}

function extractBuffer(asset: OutputChunk | OutputAsset): string | undefined {
  switch (asset.type) {
    case 'chunk':
      return asset.code;
    case 'asset':
      return typeof asset.source === 'string' ? asset.source : new TextDecoder().decode(asset.source);
    default:
      return void 0;
  }
}

function getAssetType(asset: OutputChunk | OutputAsset): string {
  return asset.type;
}
