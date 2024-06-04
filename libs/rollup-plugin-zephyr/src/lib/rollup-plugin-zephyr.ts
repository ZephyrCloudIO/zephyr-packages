import { InputOptions, NormalizedOutputOptions, OutputBundle } from 'rollup';
import { createApplicationUID, ze_error, ze_log, ZeApplicationConfig, ZephyrPluginOptions } from 'zephyr-edge-contract';
import {
  checkAuth,
  createSnapshot,
  get_hash_list,
  get_missing_assets,
  getApplicationConfiguration,
  getBuildId,
  getGitInfo,
  getPackageJson,
  update_hash_list,
  zeEnableSnapshotOnEdge,
  zeUploadAssets,
  zeUploadBuildStats,
  zeUploadSnapshot,
} from 'zephyr-agent';
import { getAssetsMap } from './utils/get-assets-map';
import { getDashData } from './utils/get-dash-data';

interface ZephyrPluginState {
  appConfig: ZeApplicationConfig;
  buildId: string | void;
  hash_set: { hash_set: Set<string> };
  pluginOptions: ZephyrPluginOptions;
}

const getInputFolder = (options: InputOptions): string => {
  if (typeof options.input === 'string') return options.input;
  if (Array.isArray(options.input)) return options.input[0];
  if (typeof options.input === 'object') return Object.values(options.input)[0];
  return process.cwd();
};

export function withZephyr() {
  let _state: Promise<ZephyrPluginState | void>;

  return {
    name: 'with-zephyr',
    buildStart: async (options: InputOptions) => {
      _state = (async function zephyr_init(): Promise<ZephyrPluginState | void> {
        ze_log('Setting up zephyr agent configuration.');

        const isCI = false;
        const _zephyrOptions = { wait_for_index_html: false };
        const path_to_execution_dir = getInputFolder(options);

        const [packageJson, gitInfo] = await Promise.all([
          getPackageJson(path_to_execution_dir),
          getGitInfo(),
        ]);

        const application_uid = createApplicationUID({
          org: gitInfo.app.org,
          project: gitInfo.app.project,
          name: packageJson.name,
        });

        await checkAuth();

        const [appConfig, buildId, hash_set] = await Promise.all([
          getApplicationConfiguration({ application_uid }),
          getBuildId(application_uid),
          get_hash_list(application_uid),
        ]);

        const { username, email, EDGE_URL } = appConfig;
        ze_log('Got application configuration: ', { username, email, EDGE_URL });
        ze_log(`Got build id: ${buildId}`);

        if (!buildId) return ze_error('[zephyr]: Could not get build id');

        const pluginOptions = {
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
          git: gitInfo.git,
          isCI: isCI,
          zeConfig: {
            user: username,
            edge_url: EDGE_URL,
            buildId: buildId,
          },
          mfConfig: void 0,
          wait_for_index_html: _zephyrOptions?.wait_for_index_html,
        };

        return {
          appConfig,
          buildId,
          hash_set,
          pluginOptions,
        };
      })();
    },
    writeBundle: async (
      options: NormalizedOutputOptions,
      bundle: OutputBundle,
    ) => {
      const zeStart = Date.now();

      await (async function zephyr_upload(props: { state: Promise<ZephyrPluginState | void>, bundle: OutputBundle }) {
        ze_log('zephyr agent started.');
        const { state, bundle } = props;
        const _state = await state;

        if (!_state) return ze_error('[zephyr]: Could not initialize zephyr agent.');

        const { appConfig, hash_set, pluginOptions } = _state;
        const { username, email } = appConfig;

        const assetsMap = getAssetsMap(bundle);
        const snapshot = createSnapshot({
          options: pluginOptions,
          assets: assetsMap,
          username,
          email,
        });

        const [,, envs] = await Promise.all([
          zeUploadSnapshot(pluginOptions, snapshot),
          (async function upload_assets() {
            const missingAssets = get_missing_assets({ assetsMap, hash_set })

            const upload_success = await zeUploadAssets(pluginOptions, {
              missingAssets,
              assetsMap,
              count: Object.keys(bundle).length,
            });
            if (upload_success && missingAssets.length) {
              await update_hash_list(pluginOptions.application_uid, assetsMap);
            }
            return upload_success;
          })(),
          (async function upload_build_stats_nd_enable_envs() {
            const dashData = getDashData({ appConfig, pluginOptions });
            return zeUploadBuildStats(dashData);
          })(),
        ]);

        if (!envs) return ze_error('[zephyr]: Could not get envs');
        return zeEnableSnapshotOnEdge({ pluginOptions, envs_jwt: envs.value, zeStart });
      })({ state: _state, bundle });


      console.log('zephyr agent done in', Date.now() - zeStart, 'ms');
    },
  };
}
