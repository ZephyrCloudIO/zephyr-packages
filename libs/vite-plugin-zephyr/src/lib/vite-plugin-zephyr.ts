import * as isCI from 'is-ci';
import type { NormalizedOutputOptions, OutputAsset, OutputBundle, OutputChunk } from 'rollup';
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
  black,
  blackBright,
  createApplicationUID,
  cyanBright,
  getPartialAssetMap,
  removePartialAssetMap,
  yellow,
  ze_error,
  ze_log,
  type ZephyrPluginOptions,
} from 'zephyr-edge-contract';
import { load_public_dir } from './load_public_dir';
import { load_static_entries } from './load_static_entries';
import type { ZephyrInternalOptions } from './zephyr-internal-options';

interface ZephyrPartialInternalOptions {
  root: string;
  configFile: string;
  outDir: string;
  publicDir?: string;
}

export function withZephyr(): Plugin {
  // todo: set correctly
  let bundle: OutputBundle = {};

  const vite_internal_options = {} as ZephyrPartialInternalOptions;

  return {
    name: 'with-zephyr',
    enforce: 'post',
    configResolved: async (config: ResolvedConfig) => {
      Object.assign(vite_internal_options, {
        root: config.root,
        configFile: config.configFile,
        outDir: config.build.outDir,
        publicDir: config.publicDir,
      });
    },
    writeBundle: async (options: NormalizedOutputOptions, _bundle: OutputBundle) => {
      bundle = _bundle;
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
        bundle,
      });
      publicAssets.push(..._static_assets);

      const assets = Object.assign({}, bundle, ...publicAssets.map((asset) => ({ [asset.fileName]: asset })));

      await _zephyr({ assets, vite_internal_options });
    },
  };
}

async function _zephyr(options: { assets: OutputBundle; vite_internal_options: ZephyrInternalOptions }) {
  const { assets: _assets, vite_internal_options } = options;
  const path_to_execution_dir = vite_internal_options.root;

  ze_log('Configuring with Zephyr...');
  const packageJson = await getPackageJson(path_to_execution_dir);
  ze_log('Loaded package.json.', packageJson);
  if (!packageJson) return ze_error('ZE10010', 'package.json not found.');

  const gitInfo = await getGitInfo();
  ze_log('Loaded Git Info.', gitInfo);
  if (!gitInfo || !gitInfo?.app.org || !gitInfo?.app.project)
    return ze_error('ZE10016', 'Could not get git info. \n Can you confirm this directory has initialized as a git repository? ');
  if (!packageJson?.name) return ze_error('ZE10013', 'package.json must have a name and version.');

  const application_uid = createApplicationUID({
    org: gitInfo.app.org,
    project: gitInfo.app.project,
    name: packageJson?.name,
  });

  ze_log('Going to check auth token or get it...');
  await checkAuth();

  ze_log('Got auth token, going to get application configuration and build id...');
  const [appConfig, buildId, hash_set] = await Promise.all([
    getApplicationConfiguration({ application_uid }),
    getBuildId(application_uid).catch((err: Error) => {
      logEvent({
        level: 'error',
        action: 'build:get-build-id:error',
        message: `error receiving build number for '${email}'\n
          ${err.message}\n`,
      });
    }),
    get_hash_list(application_uid),
  ]);
  const { username, email, EDGE_URL } = appConfig;

  ze_log('Got application configuration', { username, email, EDGE_URL });

  if (!buildId) return ze_error('ZE10019', 'Could not get build id.');

  const pluginOptions: ZephyrPluginOptions = {
    pluginName: 'rollup-plugin-zephyr',
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

  logEvent(
    {
      level: 'info',
      action: 'build:info:user',
      message: `Hi ${cyanBright(username)}!`,
    },
    {
      level: 'info',
      action: 'build:info:id',
      message: `Building to ${blackBright(application_uid)}${yellow(`#${buildId}`)}`,
    }
  );

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
    uploadConfig: appConfig.uploadConfig,
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
