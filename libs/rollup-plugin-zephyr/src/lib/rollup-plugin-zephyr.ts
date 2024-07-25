import * as isCI from 'is-ci';
import type {
  InputOptions,
  NormalizedOutputOptions,
  OutputBundle,
} from 'rollup';
import {
  checkAuth,
  getApplicationConfiguration,
  getBuildId,
  getGitInfo,
  getPackageJson,
  get_hash_list,
  get_missing_assets,
  logger,
  upload,
} from 'zephyr-agent';
import {
  type ZeApplicationConfig,
  type ZephyrPluginOptions,
  black,
  blackBright,
  createApplicationUID,
  cyanBright,
  ze_error,
  ze_log,
} from 'zephyr-edge-contract';
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
      _state =
        (async function zephyr_init(): Promise<ZephyrPluginState | void> {
          ze_log('Setting up zephyr agent configuration.');

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
          ze_log('Got application configuration: ', {
            username,
            email,
            EDGE_URL,
          });
          ze_log(`Got build id: ${buildId}`);

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
              message: `Building to ${blackBright(application_uid)}${black(`#${buildId}`)}`,
            }
          );

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
      bundle: OutputBundle
    ) => {
      const zeStart = Date.now();

      await (async function zephyr_upload(props: {
        state: Promise<ZephyrPluginState | void>;
        bundle: OutputBundle;
      }) {
        ze_log('zephyr agent started...');
        const { state, bundle } = props;
        const _state = await state;

        if (!_state)
          return ze_error('ZE10020', 'Could not initialize Zephyr Agent.');

        const { appConfig, hash_set, pluginOptions } = _state;

        const assetsMap = getAssetsMap(bundle);
        const missingAssets = get_missing_assets({ assetsMap, hash_set });
        await upload({
          pluginOptions,
          assets: {
            assetsMap,
            missingAssets,
            outputPath: options.dir as string,
            count: Object.keys(bundle).length,
          },
          getDashData,
          appConfig,
          zeStart,
          uploadConfig: appConfig.uploadConfig,
        });
      })({ state: _state, bundle });

      console.log('zephyr agent done in', Date.now() - zeStart, 'ms');
    },
  };
}
